package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Metrics
var (
	cacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"operation"},
	)

	cacheMisses = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"operation"},
	)

	cacheLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "cache_operation_duration_seconds",
			Help:    "Cache operation duration in seconds",
			Buckets: []float64{.0001, .0005, .001, .005, .01, .025, .05, .1},
		},
		[]string{"operation"},
	)

	cacheErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_errors_total",
			Help: "Total number of cache errors",
		},
		[]string{"operation"},
	)
)

// Config holds Redis cache configuration
type Config struct {
	Host         string
	Port         int
	Password     string
	DB           int
	PoolSize     int
	MinIdleConns int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// Client wraps Redis client with additional functionality
type Client struct {
	rdb    *redis.Client
	logger *zap.Logger
}

// NewClient creates a new Redis cache client
func NewClient(cfg Config, logger *zap.Logger) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &Client{
		rdb:    rdb,
		logger: logger,
	}, nil
}

// Redis returns the underlying Redis client
func (c *Client) Redis() *redis.Client {
	return c.rdb
}

// Get retrieves a value from cache
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	start := time.Now()
	defer func() {
		cacheLatency.WithLabelValues("get").Observe(time.Since(start).Seconds())
	}()

	val, err := c.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		cacheMisses.WithLabelValues("get").Inc()
		return "", nil
	}
	if err != nil {
		cacheErrors.WithLabelValues("get").Inc()
		return "", err
	}

	cacheHits.WithLabelValues("get").Inc()
	return val, nil
}

// Set stores a value in cache with expiration
func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	start := time.Now()
	defer func() {
		cacheLatency.WithLabelValues("set").Observe(time.Since(start).Seconds())
	}()

	var data string
	switch v := value.(type) {
	case string:
		data = v
	case []byte:
		data = string(v)
	default:
		bytes, err := json.Marshal(value)
		if err != nil {
			cacheErrors.WithLabelValues("set").Inc()
			return err
		}
		data = string(bytes)
	}

	err := c.rdb.Set(ctx, key, data, expiration).Err()
	if err != nil {
		cacheErrors.WithLabelValues("set").Inc()
		return err
	}

	return nil
}

// Delete removes a key from cache
func (c *Client) Delete(ctx context.Context, keys ...string) error {
	start := time.Now()
	defer func() {
		cacheLatency.WithLabelValues("delete").Observe(time.Since(start).Seconds())
	}()

	err := c.rdb.Del(ctx, keys...).Err()
	if err != nil {
		cacheErrors.WithLabelValues("delete").Inc()
		return err
	}

	return nil
}

// GetJSON retrieves and unmarshals JSON value from cache
func (c *Client) GetJSON(ctx context.Context, key string, dest interface{}) (bool, error) {
	val, err := c.Get(ctx, key)
	if err != nil {
		return false, err
	}
	if val == "" {
		return false, nil
	}

	if err := json.Unmarshal([]byte(val), dest); err != nil {
		return false, err
	}

	return true, nil
}

// SetJSON marshals and stores JSON value in cache
func (c *Client) SetJSON(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return c.Set(ctx, key, string(data), expiration)
}

// Exists checks if a key exists
func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
	n, err := c.rdb.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// Expire sets expiration on a key
func (c *Client) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return c.rdb.Expire(ctx, key, expiration).Err()
}

// TTL returns the time to live for a key
func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.rdb.TTL(ctx, key).Result()
}

// Increment increments a counter
func (c *Client) Increment(ctx context.Context, key string) (int64, error) {
	return c.rdb.Incr(ctx, key).Result()
}

// IncrementBy increments a counter by a specific amount
func (c *Client) IncrementBy(ctx context.Context, key string, value int64) (int64, error) {
	return c.rdb.IncrBy(ctx, key, value).Result()
}

// HGet retrieves a hash field
func (c *Client) HGet(ctx context.Context, key, field string) (string, error) {
	return c.rdb.HGet(ctx, key, field).Result()
}

// HSet sets a hash field
func (c *Client) HSet(ctx context.Context, key string, values ...interface{}) error {
	return c.rdb.HSet(ctx, key, values...).Err()
}

// HGetAll retrieves all hash fields
func (c *Client) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return c.rdb.HGetAll(ctx, key).Result()
}

// SAdd adds members to a set
func (c *Client) SAdd(ctx context.Context, key string, members ...interface{}) error {
	return c.rdb.SAdd(ctx, key, members...).Err()
}

// SMembers retrieves all set members
func (c *Client) SMembers(ctx context.Context, key string) ([]string, error) {
	return c.rdb.SMembers(ctx, key).Result()
}

// SIsMember checks if a value is in a set
func (c *Client) SIsMember(ctx context.Context, key string, member interface{}) (bool, error) {
	return c.rdb.SIsMember(ctx, key, member).Result()
}

// LPush pushes elements to the left of a list
func (c *Client) LPush(ctx context.Context, key string, values ...interface{}) error {
	return c.rdb.LPush(ctx, key, values...).Err()
}

// LRange retrieves list elements
func (c *Client) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return c.rdb.LRange(ctx, key, start, stop).Result()
}

// Ping checks Redis connectivity
func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// Close closes the Redis connection
func (c *Client) Close() error {
	return c.rdb.Close()
}

// HealthCheck returns a health check function
func (c *Client) HealthCheck() func() error {
	return func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return c.Ping(ctx)
	}
}

// Session management

// SetSession stores a session
func (c *Client) SetSession(ctx context.Context, sessionID string, data interface{}, expiration time.Duration) error {
	key := fmt.Sprintf("session:%s", sessionID)
	return c.SetJSON(ctx, key, data, expiration)
}

// GetSession retrieves a session
func (c *Client) GetSession(ctx context.Context, sessionID string, dest interface{}) (bool, error) {
	key := fmt.Sprintf("session:%s", sessionID)
	return c.GetJSON(ctx, key, dest)
}

// DeleteSession removes a session
func (c *Client) DeleteSession(ctx context.Context, sessionID string) error {
	key := fmt.Sprintf("session:%s", sessionID)
	return c.Delete(ctx, key)
}

// RefreshSession extends session expiration
func (c *Client) RefreshSession(ctx context.Context, sessionID string, expiration time.Duration) error {
	key := fmt.Sprintf("session:%s", sessionID)
	return c.Expire(ctx, key, expiration)
}
