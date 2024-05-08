package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sony/gobreaker"
)

// CircuitBreakerMiddleware wraps HTTP calls with circuit breaker pattern
func CircuitBreakerMiddleware(name string, maxRequests uint32, interval, timeout time.Duration) gin.HandlerFunc {
	settings := gobreaker.Settings{
		Name:        name,
		MaxRequests: maxRequests,
		Interval:    interval,
		Timeout:     timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			// Log state changes
		},
	}

	cb := gobreaker.NewCircuitBreaker(settings)

	return func(c *gin.Context) {
		_, err := cb.Execute(func() (interface{}, error) {
			c.Next()

			if c.Writer.Status() >= 500 {
				return nil, &circuitError{status: c.Writer.Status()}
			}

			return nil, nil
		})

		if err != nil {
			if _, ok := err.(*circuitError); !ok {
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "SERVICE_UNAVAILABLE",
						"message": "service temporarily unavailable",
					},
				})
			}
		}
	}
}

type circuitError struct {
	status int
}

func (e *circuitError) Error() string {
	return "circuit breaker triggered"
}

// RetryMiddleware implements retry logic for transient failures
type RetryConfig struct {
	MaxRetries  int
	InitialWait time.Duration
	MaxWait     time.Duration
	Multiplier  float64
}

// DefaultRetryConfig returns default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:  3,
		InitialWait: 100 * time.Millisecond,
		MaxWait:     2 * time.Second,
		Multiplier:  2.0,
	}
}

// HealthCheck returns a simple health check handler
func HealthCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// ReadinessCheck returns a readiness check handler
func ReadinessCheck(checks ...func() error) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, check := range checks {
			if err := check(); err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{
					"status":    "not ready",
					"error":     err.Error(),
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// LivenessCheck returns a liveness check handler
func LivenessCheck() gin.HandlerFunc {
	startTime := time.Now()

	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "alive",
			"uptime":    time.Since(startTime).String(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}
