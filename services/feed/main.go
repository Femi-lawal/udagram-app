package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/Femi-lawal/udagram-app/pkg/cache"
	"github.com/Femi-lawal/udagram-app/pkg/common"
	"github.com/Femi-lawal/udagram-app/pkg/database"
	"github.com/Femi-lawal/udagram-app/pkg/messaging"
	"github.com/Femi-lawal/udagram-app/pkg/middleware"
	"github.com/Femi-lawal/udagram-app/pkg/telemetry"
)

// FeedItem model
type FeedItem struct {
	ID        string    `gorm:"primaryKey;type:uuid" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	Caption   string    `json:"caption"`
	URL       string    `gorm:"not null" json:"url"`
	SignedURL string    `gorm:"-" json:"signed_url,omitempty"`
	Likes     int       `gorm:"default:0" json:"likes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the table name for FeedItem
func (FeedItem) TableName() string {
	return "feed_items"
}

// CreateFeedRequest represents create feed request
type CreateFeedRequest struct {
	Caption string `json:"caption" binding:"required"`
	URL     string `json:"url" binding:"required"`
}

// UpdateFeedRequest represents update feed request
type UpdateFeedRequest struct {
	Caption string `json:"caption"`
}

// FeedResponse represents paginated feed response
type FeedResponse struct {
	Items      []FeedItem `json:"items"`
	Count      int64      `json:"count"`
	Page       int        `json:"page"`
	PerPage    int        `json:"per_page"`
	TotalPages int        `json:"total_pages"`
}

// FeedService handles feed operations
type FeedService struct {
	db       *database.Client
	cache    *cache.Client
	producer *messaging.Producer
	s3Client *s3.Client
	s3Bucket string
	logger   *zap.Logger
}

func main() {
	// Initialize logger
	logger := common.InitLogger("feed-service", os.Getenv("ENVIRONMENT"))
	defer common.Sync()

	// Initialize telemetry
	ctx := context.Background()
	tp, err := telemetry.NewProvider(ctx, telemetry.Config{
		ServiceName:  "feed-service",
		Environment:  os.Getenv("ENVIRONMENT"),
		OTLPEndpoint: os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		SampleRate:   1.0,
		Enabled:      os.Getenv("TELEMETRY_ENABLED") == "true",
	})
	if err != nil {
		logger.Warn("failed to initialize telemetry", zap.Error(err))
	}

	// Initialize database
	db, err := database.NewClient(database.Config{
		Host:            getEnv("POSTGRES_HOST", "localhost"),
		Port:            getEnvInt("POSTGRES_PORT", 5432),
		User:            getEnv("POSTGRES_USER", "udagram"),
		Password:        getEnv("POSTGRES_PASSWORD", ""),
		DBName:          getEnv("POSTGRES_DB", "udagram"),
		SSLMode:         getEnv("POSTGRES_SSLMODE", "disable"),
		MaxIdleConns:    10,
		MaxOpenConns:    100,
		ConnMaxLifetime: 30 * time.Minute,
	}, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(&FeedItem{}); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	// Initialize Redis
	redisClient, err := cache.NewClient(cache.Config{
		Host:         getEnv("REDIS_HOST", "localhost"),
		Port:         getEnvInt("REDIS_PORT", 6379),
		Password:     getEnv("REDIS_PASSWORD", ""),
		DB:           0,
		PoolSize:     10,
		MinIdleConns: 5,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	}, logger)
	if err != nil {
		logger.Warn("failed to connect to Redis, continuing without cache", zap.Error(err))
	}

	// Initialize Kafka producer
	var producer *messaging.Producer
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	if kafkaBrokers != "" {
		producer = messaging.NewProducer(messaging.Config{
			Brokers: []string{kafkaBrokers},
		}, logger)
	}

	// Initialize S3 client
	var s3Client *s3.Client
	awsRegion := getEnv("AWS_REGION", "us-east-1")
	awsAccessKey := getEnv("AWS_ACCESS_KEY_ID", "")
	awsSecretKey := getEnv("AWS_SECRET_ACCESS_KEY", "")

	if awsAccessKey != "" && awsSecretKey != "" {
		cfg, err := config.LoadDefaultConfig(ctx,
			config.WithRegion(awsRegion),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				awsAccessKey, awsSecretKey, "",
			)),
		)
		if err != nil {
			logger.Warn("failed to load AWS config", zap.Error(err))
		} else {
			s3Client = s3.NewFromConfig(cfg)
		}
	}

	// Create feed service
	feedService := &FeedService{
		db:       db,
		cache:    redisClient,
		producer: producer,
		s3Client: s3Client,
		s3Bucket: getEnv("AWS_BUCKET", "udagram-media"),
		logger:   logger,
	}

	// Setup router
	if os.Getenv("ENVIRONMENT") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.LoggerMiddleware(logger))
	router.Use(middleware.MetricsMiddleware())

	// Health endpoints
	router.GET("/health", middleware.HealthCheck())
	router.GET("/ready", middleware.ReadinessCheck(db.HealthCheck()))
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Feed routes
	api := router.Group("/api/v1/feed")
	{
		api.GET("", feedService.GetFeed)
		api.GET("/:id", feedService.GetFeedItem)
		api.POST("", feedService.CreateFeedItem)
		api.PUT("/:id", feedService.UpdateFeedItem)
		api.DELETE("/:id", feedService.DeleteFeedItem)
		api.GET("/signed-url/:filename", feedService.GetSignedURL)
		api.POST("/:id/like", feedService.LikeFeedItem)
	}

	// Legacy v0 routes
	v0 := router.Group("/api/v0/feed")
	{
		v0.GET("", feedService.GetFeed)
		v0.GET("/:id", feedService.GetFeedItem)
		v0.POST("", feedService.CreateFeedItem)
		v0.GET("/signed-url/:filename", feedService.GetSignedURL)
	}

	// Start server
	port := getEnvInt("PORT", 8082)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("starting feed service", zap.Int("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	if tp != nil {
		tp.Shutdown(ctx)
	}

	logger.Info("server exited")
}

// GetFeed returns paginated feed items
func (s *FeedService) GetFeed(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 10
	}

	// Try cache first
	cacheKey := fmt.Sprintf("feed:page:%d:size:%d", page, perPage)
	if s.cache != nil {
		var cached FeedResponse
		if found, _ := s.cache.GetJSON(c.Request.Context(), cacheKey, &cached); found {
			common.SuccessResponse(c, cached)
			return
		}
	}

	var items []FeedItem
	var total int64

	// Get total count
	s.db.DB().Model(&FeedItem{}).Count(&total)

	// Get items
	offset := (page - 1) * perPage
	if err := s.db.DB().Order("created_at DESC").Offset(offset).Limit(perPage).Find(&items).Error; err != nil {
		s.logger.Error("failed to fetch feed", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Generate signed URLs
	for i := range items {
		if items[i].URL != "" && s.s3Client != nil {
			items[i].SignedURL = s.getSignedGetURL(items[i].URL)
		}
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response := FeedResponse{
		Items:      items,
		Count:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	}

	// Cache the response
	if s.cache != nil {
		s.cache.SetJSON(c.Request.Context(), cacheKey, response, 5*time.Minute)
	}

	common.SuccessResponse(c, response)
}

// GetFeedItem returns a single feed item
func (s *FeedService) GetFeedItem(c *gin.Context) {
	id := c.Param("id")

	var item FeedItem
	if err := s.db.DB().First(&item, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.NotFoundResponse(c, "feed item not found")
			return
		}
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Generate signed URL
	if item.URL != "" && s.s3Client != nil {
		item.SignedURL = s.getSignedGetURL(item.URL)
	}

	common.SuccessResponse(c, item)
}

// CreateFeedItem creates a new feed item
func (s *FeedService) CreateFeedItem(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		common.UnauthorizedResponse(c, "user not authenticated")
		return
	}

	var req CreateFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	item := FeedItem{
		ID:        uuid.New().String(),
		UserID:    userID,
		Caption:   req.Caption,
		URL:       req.URL,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.db.DB().Create(&item).Error; err != nil {
		s.logger.Error("failed to create feed item", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Generate signed URL for response
	if item.URL != "" && s.s3Client != nil {
		item.SignedURL = s.getSignedGetURL(item.URL)
	}

	// Invalidate cache
	if s.cache != nil {
		s.invalidateFeedCache(c.Request.Context())
	}

	// Publish event
	if s.producer != nil {
		event := messaging.NewEvent("feed.created", "feed-service", map[string]interface{}{
			"feed_id": item.ID,
			"user_id": item.UserID,
			"caption": item.Caption,
		})
		s.producer.PublishAsync(c.Request.Context(), messaging.TopicFeedCreated, item.ID, event)
	}

	common.CreatedResponse(c, item)
}

// UpdateFeedItem updates a feed item
func (s *FeedService) UpdateFeedItem(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")

	var item FeedItem
	if err := s.db.DB().First(&item, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.NotFoundResponse(c, "feed item not found")
			return
		}
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Check ownership
	if item.UserID != userID {
		common.ForbiddenResponse(c, "not authorized to update this item")
		return
	}

	var req UpdateFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	item.Caption = req.Caption
	item.UpdatedAt = time.Now()

	if err := s.db.DB().Save(&item).Error; err != nil {
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Invalidate cache
	if s.cache != nil {
		s.invalidateFeedCache(c.Request.Context())
	}

	common.SuccessResponse(c, item)
}

// DeleteFeedItem deletes a feed item
func (s *FeedService) DeleteFeedItem(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")

	var item FeedItem
	if err := s.db.DB().First(&item, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.NotFoundResponse(c, "feed item not found")
			return
		}
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Check ownership
	if item.UserID != userID {
		common.ForbiddenResponse(c, "not authorized to delete this item")
		return
	}

	if err := s.db.DB().Delete(&item).Error; err != nil {
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Invalidate cache
	if s.cache != nil {
		s.invalidateFeedCache(c.Request.Context())
	}

	// Publish event
	if s.producer != nil {
		event := messaging.NewEvent("feed.deleted", "feed-service", map[string]interface{}{
			"feed_id": item.ID,
			"user_id": item.UserID,
		})
		s.producer.PublishAsync(c.Request.Context(), messaging.TopicFeedDeleted, item.ID, event)
	}

	common.NoContentResponse(c)
}

// GetSignedURL returns a signed URL for uploading
func (s *FeedService) GetSignedURL(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		common.UnauthorizedResponse(c, "user not authenticated")
		return
	}

	filename := c.Param("filename")
	if filename == "" {
		common.BadRequestResponse(c, "filename is required")
		return
	}

	// Generate unique key
	key := fmt.Sprintf("uploads/%s/%s_%s", userID, uuid.New().String(), filename)

	if s.s3Client == nil {
		// Return mock URL for testing
		common.SuccessResponse(c, gin.H{
			"url": fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.s3Bucket, key),
			"key": key,
		})
		return
	}

	// Generate presigned URL
	presigner := s3.NewPresignClient(s.s3Client)
	request, err := presigner.PresignPutObject(c.Request.Context(), &s3.PutObjectInput{
		Bucket: aws.String(s.s3Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(5*time.Minute))

	if err != nil {
		s.logger.Error("failed to generate presigned URL", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, gin.H{
		"url": request.URL,
		"key": key,
	})
}

// LikeFeedItem increments the like count
func (s *FeedService) LikeFeedItem(c *gin.Context) {
	id := c.Param("id")

	var item FeedItem
	if err := s.db.DB().First(&item, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.NotFoundResponse(c, "feed item not found")
			return
		}
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	item.Likes++
	if err := s.db.DB().Save(&item).Error; err != nil {
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, gin.H{
		"likes": item.Likes,
	})
}

func (s *FeedService) getSignedGetURL(key string) string {
	if s.s3Client == nil {
		return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.s3Bucket, key)
	}

	presigner := s3.NewPresignClient(s.s3Client)
	request, err := presigner.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.s3Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(5*time.Minute))

	if err != nil {
		return ""
	}

	return request.URL
}

func (s *FeedService) invalidateFeedCache(ctx context.Context) {
	// Delete cache entries (simplified - in production, use cache tags or patterns)
	for i := 1; i <= 10; i++ {
		for _, size := range []int{10, 20, 50} {
			key := fmt.Sprintf("feed:page:%d:size:%d", i, size)
			s.cache.Delete(ctx, key)
		}
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		fmt.Sscanf(value, "%d", &result)
		return result
	}
	return defaultValue
}
