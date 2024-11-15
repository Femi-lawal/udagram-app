package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRateLimiter_AllowsWithinLimit(t *testing.T) {
	limiter := NewRateLimiter(10, 10, time.Minute)
	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Make requests within limit
	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed", i+1)
	}
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	limiter := NewRateLimiter(1, 5, time.Minute)
	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Exhaust the burst
	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.2:12345"
		router.ServeHTTP(w, req)
	}

	// Next request should be rate limited
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.2:12345"
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	limiter := NewRateLimiter(1, 2, time.Minute)
	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Exhaust limit for IP1
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.10:12345"
		router.ServeHTTP(w, req)
	}

	// IP2 should still work
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.20:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestNewRateLimiter(t *testing.T) {
	limiter := NewRateLimiter(100, 200, time.Minute)
	assert.NotNil(t, limiter)
	assert.NotNil(t, limiter.visitors)
}

func TestUserRateLimiter(t *testing.T) {
	limiter := NewUserRateLimiter(10, 10, time.Minute)
	assert.NotNil(t, limiter)
	assert.NotNil(t, limiter.users)
}
