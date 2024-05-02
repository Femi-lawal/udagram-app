package middleware

import (
	"sync"
	"time"

	"github.com/Femi-lawal/udagram-app/pkg/common"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiter manages rate limiting per client
type RateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
	cleanup  time.Duration
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerSecond float64, burst int, cleanupInterval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate.Limit(requestsPerSecond),
		burst:    burst,
		cleanup:  cleanupInterval,
	}

	go rl.cleanupVisitors()

	return rl
}

func (rl *RateLimiter) getVisitor(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(rl.rate, rl.burst)
		rl.visitors[ip] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func (rl *RateLimiter) cleanupVisitors() {
	for {
		time.Sleep(rl.cleanup)

		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimitMiddleware returns a Gin middleware for rate limiting
func RateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := rl.getVisitor(ip)

		if !limiter.Allow() {
			common.TooManyRequestsResponse(c)
			c.Abort()
			return
		}

		c.Next()
	}
}

// UserRateLimiter manages rate limiting per user
type UserRateLimiter struct {
	users   map[string]*visitor
	mu      sync.RWMutex
	rate    rate.Limit
	burst   int
	cleanup time.Duration
}

// NewUserRateLimiter creates a new user-based rate limiter
func NewUserRateLimiter(requestsPerSecond float64, burst int, cleanupInterval time.Duration) *UserRateLimiter {
	rl := &UserRateLimiter{
		users:   make(map[string]*visitor),
		rate:    rate.Limit(requestsPerSecond),
		burst:   burst,
		cleanup: cleanupInterval,
	}

	go rl.cleanupUsers()

	return rl
}

func (rl *UserRateLimiter) getUser(userID string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.users[userID]
	if !exists {
		limiter := rate.NewLimiter(rl.rate, rl.burst)
		rl.users[userID] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func (rl *UserRateLimiter) cleanupUsers() {
	for {
		time.Sleep(rl.cleanup)

		rl.mu.Lock()
		for id, v := range rl.users {
			if time.Since(v.lastSeen) > 5*time.Minute {
				delete(rl.users, id)
			}
		}
		rl.mu.Unlock()
	}
}

// UserRateLimitMiddleware returns a Gin middleware for user-based rate limiting
func UserRateLimitMiddleware(rl *UserRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			// Fall back to IP-based limiting if not authenticated
			c.Next()
			return
		}

		limiter := rl.getUser(userID.(string))

		if !limiter.Allow() {
			common.TooManyRequestsResponse(c)
			c.Abort()
			return
		}

		c.Next()
	}
}
