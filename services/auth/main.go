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
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/Femi-lawal/udagram-app/pkg/cache"
	"github.com/Femi-lawal/udagram-app/pkg/common"
	"github.com/Femi-lawal/udagram-app/pkg/database"
	"github.com/Femi-lawal/udagram-app/pkg/messaging"
	"github.com/Femi-lawal/udagram-app/pkg/middleware"
	"github.com/Femi-lawal/udagram-app/pkg/telemetry"
)

// User model
type User struct {
	ID           string    `gorm:"primaryKey;type:uuid" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	FirstName    string    `json:"first_name,omitempty"`
	LastName     string    `json:"last_name,omitempty"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName returns the table name for User
func (User) TableName() string {
	return "users"
}

// Short returns a safe version of user
func (u *User) Short() map[string]interface{} {
	return map[string]interface{}{
		"id":         u.ID,
		"email":      u.Email,
		"first_name": u.FirstName,
		"last_name":  u.LastName,
		"avatar_url": u.AvatarURL,
		"created_at": u.CreatedAt,
	}
}

// RefreshToken model
type RefreshToken struct {
	ID        string    `gorm:"primaryKey;type:uuid"`
	UserID    string    `gorm:"index;not null"`
	Token     string    `gorm:"uniqueIndex;not null"`
	ExpiresAt time.Time `gorm:"not null"`
	CreatedAt time.Time
}

// Request/Response types
type RegisterRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type TokenResponse struct {
	AccessToken  string                 `json:"access_token"`
	RefreshToken string                 `json:"refresh_token"`
	TokenType    string                 `json:"token_type"`
	ExpiresIn    int64                  `json:"expires_in"`
	User         map[string]interface{} `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// AuthService handles authentication
type AuthService struct {
	db        *database.Client
	cache     *cache.Client
	producer  *messaging.Producer
	logger    *zap.Logger
	jwtConfig middleware.JWTConfig
}

func main() {
	// Initialize logger
	logger := common.InitLogger("auth-service", os.Getenv("ENVIRONMENT"))
	defer func() {
		_ = common.Sync()
	}()

	// Initialize telemetry
	ctx := context.Background()
	tp, err := telemetry.NewProvider(ctx, telemetry.Config{
		ServiceName:  "auth-service",
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
	defer func() {
		if err := db.Close(); err != nil {
			logger.Error("failed to close database", zap.Error(err))
		}
	}()

	// Run migrations
	if err := db.Migrate(&User{}, &RefreshToken{}); err != nil {
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

	// JWT config
	jwtConfig := middleware.JWTConfig{
		Secret:        getEnv("JWT_SECRET", "your-super-secret-key-change-in-production"),
		Issuer:        getEnv("JWT_ISSUER", "udagram"),
		Audience:      "udagram-users",
		AccessExpiry:  15 * time.Minute,
		RefreshExpiry: 7 * 24 * time.Hour,
	}

	// Create auth service
	authService := &AuthService{
		db:        db,
		cache:     redisClient,
		producer:  producer,
		logger:    logger,
		jwtConfig: jwtConfig,
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

	// Auth routes
	api := router.Group("/api/v1/auth")
	{
		api.POST("/register", authService.Register)
		api.POST("/login", authService.Login)
		api.POST("/refresh", authService.RefreshTokenHandler)
		api.POST("/logout", authService.Logout)
		api.GET("/verification", authService.Verify)
	}

	// Protected auth routes (require JWT)
	apiProtected := router.Group("/api/v1/auth")
	apiProtected.Use(middleware.JWTMiddleware(jwtConfig))
	{
		apiProtected.GET("/validate", authService.ValidateToken)
	}

	// User routes
	users := router.Group("/api/v1/users")
	users.Use(middleware.JWTMiddleware(jwtConfig))
	{
		users.GET("/me", authService.GetCurrentUser)
		users.PUT("/me", authService.UpdateCurrentUser)
		users.GET("/:id", authService.GetUser)
	}

	// Legacy v0 routes
	v0 := router.Group("/api/v0/users")
	{
		v0.POST("/auth", authService.LegacyRegister)
		v0.POST("/auth/login", authService.Login)
		v0.GET("/auth/verification", authService.Verify)
		v0.GET("/:id", authService.GetUser)
	}

	// Start server
	port := getEnvInt("PORT", 8081)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("starting auth service", zap.Int("port", port))
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
		if err := tp.Shutdown(ctx); err != nil {
			logger.Error("failed to shutdown telemetry", zap.Error(err))
		}
	}

	logger.Info("server exited")
}

// Register handles user registration
func (s *AuthService) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	// Check if user exists
	var existingUser User
	if err := s.db.DB().Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		common.ConflictResponse(c, "user already exists")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		s.logger.Error("failed to hash password", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Create user
	user := User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.db.DB().Create(&user).Error; err != nil {
		s.logger.Error("failed to create user", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Generate tokens
	accessToken, err := middleware.GenerateAccessToken(s.jwtConfig, user.ID, user.Email)
	if err != nil {
		s.logger.Error("failed to generate access token", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	refreshToken, err := s.createRefreshToken(c.Request.Context(), user.ID)
	if err != nil {
		s.logger.Error("failed to generate refresh token", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Publish event
	if s.producer != nil {
		event := messaging.NewEvent("user.created", "auth-service", map[string]interface{}{
			"user_id": user.ID,
			"email":   user.Email,
		})
		s.producer.PublishAsync(c.Request.Context(), messaging.TopicUserCreated, user.ID, event)
	}

	common.CreatedResponse(c, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.jwtConfig.AccessExpiry.Seconds()),
		User:         user.Short(),
	})
}

// LegacyRegister handles legacy v0 registration
func (s *AuthService) LegacyRegister(c *gin.Context) {
	s.Register(c)
}

// Login handles user login
func (s *AuthService) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	// Find user
	var user User
	if err := s.db.DB().Where("email = ?", req.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.UnauthorizedResponse(c, "invalid credentials")
			return
		}
		s.logger.Error("failed to find user", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	// Check if user is active
	if !user.IsActive {
		common.UnauthorizedResponse(c, "account is disabled")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		common.UnauthorizedResponse(c, "invalid credentials")
		return
	}

	// Generate tokens
	accessToken, err := middleware.GenerateAccessToken(s.jwtConfig, user.ID, user.Email)
	if err != nil {
		s.logger.Error("failed to generate access token", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	refreshToken, err := s.createRefreshToken(c.Request.Context(), user.ID)
	if err != nil {
		s.logger.Error("failed to generate refresh token", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.jwtConfig.AccessExpiry.Seconds()),
		User:         user.Short(),
	})
}

// RefreshTokenHandler handles token refresh
func (s *AuthService) RefreshTokenHandler(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	// Find refresh token
	var storedToken RefreshToken
	if err := s.db.DB().Where("token = ?", req.RefreshToken).First(&storedToken).Error; err != nil {
		common.UnauthorizedResponse(c, "invalid refresh token")
		return
	}

	// Check expiration
	if time.Now().After(storedToken.ExpiresAt) {
		s.db.DB().Delete(&storedToken)
		common.UnauthorizedResponse(c, "refresh token expired")
		return
	}

	// Find user
	var user User
	if err := s.db.DB().First(&user, "id = ?", storedToken.UserID).Error; err != nil {
		common.UnauthorizedResponse(c, "user not found")
		return
	}

	// Delete old refresh token
	s.db.DB().Delete(&storedToken)

	// Generate new tokens
	accessToken, err := middleware.GenerateAccessToken(s.jwtConfig, user.ID, user.Email)
	if err != nil {
		s.logger.Error("failed to generate access token", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	newRefreshToken, err := s.createRefreshToken(c.Request.Context(), user.ID)
	if err != nil {
		s.logger.Error("failed to generate refresh token", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.jwtConfig.AccessExpiry.Seconds()),
		User:         user.Short(),
	})
}

// Logout handles user logout
func (s *AuthService) Logout(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.NoContentResponse(c)
		return
	}

	// Delete refresh token
	s.db.DB().Where("token = ?", req.RefreshToken).Delete(&RefreshToken{})

	// Invalidate session in cache if available
	if s.cache != nil {
		userID := c.GetHeader("X-User-ID")
		if userID != "" {
			if err := s.cache.DeleteSession(c.Request.Context(), userID); err != nil {
				s.logger.Error("failed to delete session", zap.Error(err))
			}
		}
	}

	common.NoContentResponse(c)
}

// Verify verifies the JWT token (legacy, no auth required)
func (s *AuthService) Verify(c *gin.Context) {
	common.SuccessResponse(c, gin.H{
		"auth":    true,
		"message": "authenticated",
	})
}

// ValidateToken validates the JWT token and returns user info (requires auth)
func (s *AuthService) ValidateToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		common.UnauthorizedResponse(c, "not authenticated")
		return
	}

	email, _ := c.Get("email")

	common.SuccessResponse(c, gin.H{
		"valid":   true,
		"user_id": userID,
		"email":   email,
	})
}

// GetCurrentUser gets the current authenticated user
func (s *AuthService) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		common.UnauthorizedResponse(c, "not authenticated")
		return
	}

	var user User
	if err := s.db.DB().First(&user, "id = ?", userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.NotFoundResponse(c, "user not found")
			return
		}
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, user.Short())
}

// UpdateCurrentUser updates the current authenticated user
func (s *AuthService) UpdateCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		common.UnauthorizedResponse(c, "not authenticated")
		return
	}

	var updates struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&updates); err != nil {
		common.BadRequestResponse(c, "invalid request body")
		return
	}

	var user User
	if err := s.db.DB().First(&user, "id = ?", userID).Error; err != nil {
		common.NotFoundResponse(c, "user not found")
		return
	}

	user.FirstName = updates.FirstName
	user.LastName = updates.LastName
	user.AvatarURL = updates.AvatarURL
	user.UpdatedAt = time.Now()

	if err := s.db.DB().Save(&user).Error; err != nil {
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, user.Short())
}

// GetUser gets a user by ID
func (s *AuthService) GetUser(c *gin.Context) {
	id := c.Param("id")

	var user User
	if err := s.db.DB().First(&user, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			common.NotFoundResponse(c, "user not found")
			return
		}
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	common.SuccessResponse(c, user.Short())
}

func (s *AuthService) createRefreshToken(ctx context.Context, userID string) (string, error) {
	token := uuid.New().String()

	refreshToken := RefreshToken{
		ID:        uuid.New().String(),
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().Add(s.jwtConfig.RefreshExpiry),
		CreatedAt: time.Now(),
	}

	if err := s.db.DB().Create(&refreshToken).Error; err != nil {
		return "", err
	}

	return token, nil
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
		if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
			return defaultValue
		}
		return result
	}
	return defaultValue
}
