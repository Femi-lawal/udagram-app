package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"github.com/Femi-lawal/udagram-app/pkg/cache"
	"github.com/Femi-lawal/udagram-app/pkg/common"
	"github.com/Femi-lawal/udagram-app/pkg/messaging"
	"github.com/Femi-lawal/udagram-app/pkg/middleware"
	"github.com/Femi-lawal/udagram-app/pkg/telemetry"
)

// NotificationService handles notification processing
type NotificationService struct {
	cache    *cache.Client
	producer *messaging.Producer
	logger   *zap.Logger
}

func main() {
	// Initialize logger
	logger := common.InitLogger("notification-service", os.Getenv("ENVIRONMENT"))
	defer common.Sync()

	// Initialize telemetry
	ctx := context.Background()
	tp, err := telemetry.NewProvider(ctx, telemetry.Config{
		ServiceName:  "notification-service",
		Environment:  os.Getenv("ENVIRONMENT"),
		OTLPEndpoint: os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		SampleRate:   1.0,
		Enabled:      os.Getenv("TELEMETRY_ENABLED") == "true",
	})
	if err != nil {
		logger.Warn("failed to initialize telemetry", zap.Error(err))
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
		logger.Warn("failed to connect to Redis", zap.Error(err))
	}

	// Initialize Kafka producer
	var producer *messaging.Producer
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	if kafkaBrokers != "" {
		producer = messaging.NewProducer(messaging.Config{
			Brokers: []string{kafkaBrokers},
		}, logger)
	}

	// Create notification service
	notificationService := &NotificationService{
		cache:    redisClient,
		producer: producer,
		logger:   logger,
	}

	// Start Kafka consumers
	consumerCtx, cancelConsumers := context.WithCancel(context.Background())
	defer cancelConsumers()

	// User created consumer
	go func() {
		consumer := messaging.NewConsumer(
			messaging.Config{Brokers: []string{kafkaBrokers}},
			messaging.TopicUserCreated,
			"notification-group",
			logger,
			notificationService.handleUserCreated,
		)
		if err := consumer.Start(consumerCtx); err != nil && err != context.Canceled {
			logger.Error("user created consumer error", zap.Error(err))
		}
	}()

	// Feed created consumer
	go func() {
		consumer := messaging.NewConsumer(
			messaging.Config{Brokers: []string{kafkaBrokers}},
			messaging.TopicFeedCreated,
			"notification-group",
			logger,
			notificationService.handleFeedCreated,
		)
		if err := consumer.Start(consumerCtx); err != nil && err != context.Canceled {
			logger.Error("feed created consumer error", zap.Error(err))
		}
	}()

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
	router.GET("/ready", middleware.ReadinessCheck())
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Notification routes
	api := router.Group("/api/v1/notifications")
	{
		api.GET("", notificationService.GetNotifications)
		api.POST("/send", notificationService.SendNotification)
	}

	// Start server
	port := getEnvInt("PORT", 8083)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("starting notification service", zap.Int("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	cancelConsumers()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	if tp != nil {
		tp.Shutdown(shutdownCtx)
	}

	logger.Info("server exited")
}

func (s *NotificationService) handleUserCreated(ctx context.Context, event messaging.Event) error {
	s.logger.Info("handling user created event",
		zap.String("event_id", event.ID),
		zap.Any("data", event.Data),
	)

	// Send welcome notification
	userID, ok := event.Data["user_id"].(string)
	if !ok {
		return fmt.Errorf("invalid user_id in event")
	}

	notification := map[string]interface{}{
		"type":    "welcome",
		"user_id": userID,
		"message": "Welcome to Udagram! Start sharing your moments.",
		"sent_at": time.Now().UTC(),
	}

	// Store notification in Redis
	if s.cache != nil {
		key := fmt.Sprintf("notifications:%s", userID)
		s.cache.LPush(ctx, key, notification)
	}

	return nil
}

func (s *NotificationService) handleFeedCreated(ctx context.Context, event messaging.Event) error {
	s.logger.Info("handling feed created event",
		zap.String("event_id", event.ID),
		zap.Any("data", event.Data),
	)

	// In a real app, notify followers
	// For now, just log the event
	return nil
}

// GetNotifications returns user notifications
func (s *NotificationService) GetNotifications(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		common.UnauthorizedResponse(c, "user not authenticated")
		return
	}

	if s.cache == nil {
		common.SuccessResponse(c, []interface{}{})
		return
	}

	key := fmt.Sprintf("notifications:%s", userID)
	notifications, err := s.cache.LRange(c.Request.Context(), key, 0, 50)
	if err != nil {
		s.logger.Error("failed to get notifications", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, notifications)
}

// SendNotification sends a notification
func (s *NotificationService) SendNotification(c *gin.Context) {
	var req struct {
		UserID  string `json:"user_id" binding:"required"`
		Type    string `json:"type" binding:"required"`
		Message string `json:"message" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	if s.producer != nil {
		event := messaging.NewEvent("notification", "notification-service", map[string]interface{}{
			"user_id": req.UserID,
			"type":    req.Type,
			"message": req.Message,
		})
		s.producer.PublishAsync(c.Request.Context(), messaging.TopicNotification, req.UserID, event)
	}

	common.SuccessResponse(c, gin.H{
		"status": "sent",
	})
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
