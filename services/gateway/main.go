package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"github.com/Femi-lawal/udagram-app/pkg/common"
	"github.com/Femi-lawal/udagram-app/pkg/middleware"
	"github.com/Femi-lawal/udagram-app/pkg/telemetry"
)

// ServiceConfig holds service endpoint configuration
type ServiceConfig struct {
	AuthServiceURL         string
	FeedServiceURL         string
	NotificationServiceURL string
}

// Gateway handles API routing and middleware
type Gateway struct {
	router      *gin.Engine
	logger      *zap.Logger
	config      *Config
	services    ServiceConfig
	rateLimiter *middleware.RateLimiter
	telemetry   *telemetry.Provider
}

// Config holds gateway configuration
type Config struct {
	Port           int
	Environment    string
	JWTSecret      string
	JWTIssuer      string
	AllowedOrigins []string
	RateLimit      float64
	RateBurst      int
}

func main() {
	// Initialize logger
	logger := common.InitLogger("gateway", os.Getenv("ENVIRONMENT"))
	defer func() {
		_ = common.Sync()
	}()

	// Load configuration
	config := loadConfig()

	// Initialize telemetry
	ctx := context.Background()
	tp, err := telemetry.NewProvider(ctx, telemetry.Config{
		ServiceName:  "gateway",
		Environment:  config.Environment,
		OTLPEndpoint: os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		SampleRate:   1.0,
		Enabled:      os.Getenv("TELEMETRY_ENABLED") == "true",
	})
	if err != nil {
		logger.Warn("failed to initialize telemetry", zap.Error(err))
	}

	// Service URLs
	services := ServiceConfig{
		AuthServiceURL:         getEnv("AUTH_SERVICE_URL", "http://auth:8081"),
		FeedServiceURL:         getEnv("FEED_SERVICE_URL", "http://feed:8082"),
		NotificationServiceURL: getEnv("NOTIFICATION_SERVICE_URL", "http://notification:8083"),
	}

	// Create gateway
	gateway := NewGateway(config, services, logger, tp)

	// Start server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", config.Port),
		Handler:      gateway.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		logger.Info("starting gateway server", zap.Int("port", config.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
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

// NewGateway creates a new gateway instance
func NewGateway(config *Config, services ServiceConfig, logger *zap.Logger, tp *telemetry.Provider) *Gateway {
	// Set Gin mode
	if config.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Create rate limiter
	rateLimiter := middleware.NewRateLimiter(config.RateLimit, config.RateBurst, time.Minute)

	gateway := &Gateway{
		router:      router,
		logger:      logger,
		config:      config,
		services:    services,
		rateLimiter: rateLimiter,
		telemetry:   tp,
	}

	gateway.setupMiddleware()
	gateway.setupRoutes()

	return gateway
}

func (g *Gateway) setupMiddleware() {
	// Recovery middleware
	g.router.Use(middleware.RecoveryMiddleware(g.logger))

	// Request ID
	g.router.Use(middleware.RequestIDMiddleware())

	// Logging
	g.router.Use(middleware.LoggerMiddleware(g.logger))

	// Metrics
	g.router.Use(middleware.MetricsMiddleware())

	// Security headers
	g.router.Use(middleware.SecurityHeadersMiddleware())

	// CORS
	g.router.Use(middleware.CORSMiddleware(g.config.AllowedOrigins))

	// Rate limiting
	g.router.Use(middleware.RateLimitMiddleware(g.rateLimiter))
}

func (g *Gateway) setupRoutes() {
	// Health endpoints
	g.router.GET("/health", middleware.HealthCheck())
	g.router.GET("/ready", middleware.ReadinessCheck())
	g.router.GET("/live", middleware.LivenessCheck())

	// Metrics endpoint
	g.router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API v1 routes
	v1 := g.router.Group("/api/v1")
	{
		// Auth routes (public)
		auth := v1.Group("/auth")
		{
			auth.POST("/register", g.proxyToAuth)
			auth.POST("/login", g.proxyToAuth)
			auth.POST("/refresh", g.proxyToAuth)
			auth.POST("/logout", g.proxyToAuth)
		}

		// User routes (protected)
		users := v1.Group("/users")
		users.Use(g.jwtMiddleware())
		{
			users.GET("/:id", g.proxyToAuth)
			users.GET("/me", g.proxyToAuth)
			users.PUT("/me", g.proxyToAuth)
		}

		// Feed routes
		feed := v1.Group("/feed")
		{
			// Public routes
			feed.GET("", g.proxyToFeed)
			feed.GET("/:id", g.proxyToFeed)

			// Protected routes
			protected := feed.Group("")
			protected.Use(g.jwtMiddleware())
			{
				protected.POST("", g.proxyToFeed)
				protected.PUT("/:id", g.proxyToFeed)
				protected.DELETE("/:id", g.proxyToFeed)
				protected.GET("/signed-url/:filename", g.proxyToFeed)
			}
		}

		// Notification routes (protected)
		notifications := v1.Group("/notifications")
		notifications.Use(g.jwtMiddleware())
		{
			notifications.GET("", g.proxyToNotification)
			notifications.POST("/send", g.proxyToNotification)
			notifications.PUT("/:id/read", g.proxyToNotification)
		}
	}

	// Legacy API v0 routes (backwards compatibility)
	v0 := g.router.Group("/api/v0")
	{
		v0.Any("/users/*path", g.proxyToAuth)
		v0.Any("/feed/*path", g.proxyToFeed)
	}
}

func (g *Gateway) jwtMiddleware() gin.HandlerFunc {
	return middleware.JWTMiddleware(middleware.JWTConfig{
		Secret:   g.config.JWTSecret,
		Issuer:   g.config.JWTIssuer,
		Audience: "udagram-users",
	})
}

func (g *Gateway) proxyToAuth(c *gin.Context) {
	g.proxyRequest(c, g.services.AuthServiceURL)
}

func (g *Gateway) proxyToFeed(c *gin.Context) {
	g.proxyRequest(c, g.services.FeedServiceURL)
}

func (g *Gateway) proxyToNotification(c *gin.Context) {
	g.proxyRequest(c, g.services.NotificationServiceURL)
}

func (g *Gateway) proxyRequest(c *gin.Context, targetURL string) {
	target, err := url.Parse(targetURL)
	if err != nil {
		g.logger.Error("failed to parse target URL", zap.Error(err))
		common.ErrorResponse(c, common.ErrInternalServer)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Modify the request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		// Forward headers
		req.Header.Set("X-Forwarded-Host", req.Host)
		req.Header.Set("X-Forwarded-Proto", "http")

		// Forward request ID
		if requestID, exists := c.Get("request_id"); exists {
			req.Header.Set("X-Request-ID", requestID.(string))
		}

		// Forward user context if authenticated
		if userID, exists := c.Get("user_id"); exists {
			req.Header.Set("X-User-ID", userID.(string))
		}
		if email, exists := c.Get("email"); exists {
			req.Header.Set("X-User-Email", email.(string))
		}

		// Set the target path
		req.URL.Path = c.Request.URL.Path
		req.URL.RawQuery = c.Request.URL.RawQuery
	}

	// Handle errors
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		g.logger.Error("proxy error",
			zap.String("target", targetURL),
			zap.Error(err),
		)
		common.ServiceUnavailableResponse(c, "service unavailable")
	}

	proxy.ServeHTTP(c.Writer, c.Request)
}

func loadConfig() *Config {
	allowedOrigins := strings.Split(getEnv("ALLOWED_ORIGINS", "*"), ",")

	return &Config{
		Port:           getEnvInt("PORT", 8080),
		Environment:    getEnv("ENVIRONMENT", "development"),
		JWTSecret:      getEnv("JWT_SECRET", "your-super-secret-key-change-in-production"),
		JWTIssuer:      getEnv("JWT_ISSUER", "udagram"),
		AllowedOrigins: allowedOrigins,
		RateLimit:      100,
		RateBurst:      200,
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
		if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
			return defaultValue
		}
		return result
	}
	return defaultValue
}
