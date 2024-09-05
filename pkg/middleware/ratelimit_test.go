package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRateLimiter_AllowsWithinLimit(t *testing.T) {
	limiter := NewRateLimiter(10, time.Second)
	router := gin.New()
	router.Use(limiter.Middleware())
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Make 10 requests (within limit)
	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed", i+1)
	}
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	limiter := NewRateLimiter(5, time.Second)
	router := gin.New()
	router.Use(limiter.Middleware())
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Make requests over the limit
	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.2:12345"
		router.ServeHTTP(w, req)

		if i < 5 {
			assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed", i+1)
		} else {
			assert.Equal(t, http.StatusTooManyRequests, w.Code, "Request %d should be rate limited", i+1)
		}
	}
}

func TestRateLimiter_ResetsAfterWindow(t *testing.T) {
	limiter := NewRateLimiter(2, 100*time.Millisecond)
	router := gin.New()
	router.Use(limiter.Middleware())
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Exhaust the limit
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "192.168.1.3:12345"
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// This should be blocked
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.3:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	// Wait for window to reset
	time.Sleep(150 * time.Millisecond)

	// Should work again
	w = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.3:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	limiter := NewRateLimiter(2, time.Second)
	router := gin.New()
	router.Use(limiter.Middleware())
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

func TestRateLimiter_Concurrent(t *testing.T) {
	limiter := NewRateLimiter(100, time.Second)
	router := gin.New()
	router.Use(limiter.Middleware())
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	var wg sync.WaitGroup
	successCount := 0
	rateLimitedCount := 0
	var mu sync.Mutex

	// Make 150 concurrent requests
	for i := 0; i < 150; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			w := httptest.NewRecorder()
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = "192.168.1.100:12345"
			router.ServeHTTP(w, req)

			mu.Lock()
			if w.Code == http.StatusOK {
				successCount++
			} else if w.Code == http.StatusTooManyRequests {
				rateLimitedCount++
			}
			mu.Unlock()
		}()
	}

	wg.Wait()

	// Should have exactly 100 successful requests
	assert.Equal(t, 100, successCount)
	assert.Equal(t, 50, rateLimitedCount)
}

func TestRateLimiter_XForwardedFor(t *testing.T) {
	limiter := NewRateLimiter(2, time.Second)
	router := gin.New()
	router.Use(limiter.Middleware())
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Use X-Forwarded-For header
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("X-Forwarded-For", "10.0.0.1")
		req.RemoteAddr = "192.168.1.1:12345" // Proxy IP
		router.ServeHTTP(w, req)

		if i < 2 {
			assert.Equal(t, http.StatusOK, w.Code)
		} else {
			assert.Equal(t, http.StatusTooManyRequests, w.Code)
		}
	}
}

func TestRateLimiter_Headers(t *testing.T) {
	limiter := NewRateLimiter(10, time.Second)
	router := gin.New()
	router.Use(limiter.Middleware())
	router.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "192.168.1.50:12345"
	router.ServeHTTP(w, req)

	// Check rate limit headers
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"))
}
