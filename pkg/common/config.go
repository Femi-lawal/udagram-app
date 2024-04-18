package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Kafka    KafkaConfig
	JWT      JWTConfig
	AWS      AWSConfig
	Telemetry TelemetryConfig
	RateLimit RateLimitConfig
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
	Environment  string
	ServiceName  string
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	SSLMode         string
	MaxIdleConns    int
	MaxOpenConns    int
	ConnMaxLifetime time.Duration
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
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

// KafkaConfig holds Kafka configuration
type KafkaConfig struct {
	Brokers       []string
	ConsumerGroup string
	Topics        map[string]string
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret           string
	AccessExpiry     time.Duration
	RefreshExpiry    time.Duration
	Issuer           string
	Audience         string
}

// AWSConfig holds AWS configuration
type AWSConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	S3Bucket        string
	SignedURLExpiry time.Duration
}

// TelemetryConfig holds telemetry configuration
type TelemetryConfig struct {
	Enabled      bool
	OTLPEndpoint string
	ServiceName  string
	Environment  string
	SampleRate   float64
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	RequestsPerSecond float64
	Burst             int
	CleanupInterval   time.Duration
}

// Load loads configuration from environment and files
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/udagram/")

	// Set defaults
	setDefaults()

	// Bind environment variables
	viper.AutomaticEnv()
	bindEnvVars()

	// Read config file (optional)
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	config := &Config{
		Server: ServerConfig{
			Host:         viper.GetString("server.host"),
			Port:         viper.GetInt("server.port"),
			ReadTimeout:  viper.GetDuration("server.read_timeout"),
			WriteTimeout: viper.GetDuration("server.write_timeout"),
			IdleTimeout:  viper.GetDuration("server.idle_timeout"),
			Environment:  viper.GetString("server.environment"),
			ServiceName:  viper.GetString("server.service_name"),
		},
		Database: DatabaseConfig{
			Host:            viper.GetString("database.host"),
			Port:            viper.GetInt("database.port"),
			User:            viper.GetString("database.user"),
			Password:        viper.GetString("database.password"),
			DBName:          viper.GetString("database.dbname"),
			SSLMode:         viper.GetString("database.sslmode"),
			MaxIdleConns:    viper.GetInt("database.max_idle_conns"),
			MaxOpenConns:    viper.GetInt("database.max_open_conns"),
			ConnMaxLifetime: viper.GetDuration("database.conn_max_lifetime"),
		},
		Redis: RedisConfig{
			Host:         viper.GetString("redis.host"),
			Port:         viper.GetInt("redis.port"),
			Password:     viper.GetString("redis.password"),
			DB:           viper.GetInt("redis.db"),
			PoolSize:     viper.GetInt("redis.pool_size"),
			MinIdleConns: viper.GetInt("redis.min_idle_conns"),
			DialTimeout:  viper.GetDuration("redis.dial_timeout"),
			ReadTimeout:  viper.GetDuration("redis.read_timeout"),
			WriteTimeout: viper.GetDuration("redis.write_timeout"),
		},
		Kafka: KafkaConfig{
			Brokers:       viper.GetStringSlice("kafka.brokers"),
			ConsumerGroup: viper.GetString("kafka.consumer_group"),
			Topics:        viper.GetStringMapString("kafka.topics"),
		},
		JWT: JWTConfig{
			Secret:        viper.GetString("jwt.secret"),
			AccessExpiry:  viper.GetDuration("jwt.access_expiry"),
			RefreshExpiry: viper.GetDuration("jwt.refresh_expiry"),
			Issuer:        viper.GetString("jwt.issuer"),
			Audience:      viper.GetString("jwt.audience"),
		},
		AWS: AWSConfig{
			Region:          viper.GetString("aws.region"),
			AccessKeyID:     viper.GetString("aws.access_key_id"),
			SecretAccessKey: viper.GetString("aws.secret_access_key"),
			S3Bucket:        viper.GetString("aws.s3_bucket"),
			SignedURLExpiry: viper.GetDuration("aws.signed_url_expiry"),
		},
		Telemetry: TelemetryConfig{
			Enabled:      viper.GetBool("telemetry.enabled"),
			OTLPEndpoint: viper.GetString("telemetry.otlp_endpoint"),
			ServiceName:  viper.GetString("telemetry.service_name"),
			Environment:  viper.GetString("telemetry.environment"),
			SampleRate:   viper.GetFloat64("telemetry.sample_rate"),
		},
		RateLimit: RateLimitConfig{
			RequestsPerSecond: viper.GetFloat64("rate_limit.requests_per_second"),
			Burst:             viper.GetInt("rate_limit.burst"),
			CleanupInterval:   viper.GetDuration("rate_limit.cleanup_interval"),
		},
	}

	return config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", 30*time.Second)
	viper.SetDefault("server.write_timeout", 30*time.Second)
	viper.SetDefault("server.idle_timeout", 60*time.Second)
	viper.SetDefault("server.environment", "development")
	viper.SetDefault("server.service_name", "udagram")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "udagram")
	viper.SetDefault("database.password", "")
	viper.SetDefault("database.dbname", "udagram")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_idle_conns", 10)
	viper.SetDefault("database.max_open_conns", 100)
	viper.SetDefault("database.conn_max_lifetime", 30*time.Minute)

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)
	viper.SetDefault("redis.min_idle_conns", 5)
	viper.SetDefault("redis.dial_timeout", 5*time.Second)
	viper.SetDefault("redis.read_timeout", 3*time.Second)
	viper.SetDefault("redis.write_timeout", 3*time.Second)

	// Kafka defaults
	viper.SetDefault("kafka.brokers", []string{"localhost:9092"})
	viper.SetDefault("kafka.consumer_group", "udagram-group")

	// JWT defaults
	viper.SetDefault("jwt.access_expiry", 15*time.Minute)
	viper.SetDefault("jwt.refresh_expiry", 7*24*time.Hour)
	viper.SetDefault("jwt.issuer", "udagram")
	viper.SetDefault("jwt.audience", "udagram-users")

	// AWS defaults
	viper.SetDefault("aws.region", "us-east-1")
	viper.SetDefault("aws.signed_url_expiry", 5*time.Minute)

	// Telemetry defaults
	viper.SetDefault("telemetry.enabled", true)
	viper.SetDefault("telemetry.otlp_endpoint", "localhost:4317")
	viper.SetDefault("telemetry.sample_rate", 1.0)

	// Rate limit defaults
	viper.SetDefault("rate_limit.requests_per_second", 100)
	viper.SetDefault("rate_limit.burst", 200)
	viper.SetDefault("rate_limit.cleanup_interval", 1*time.Minute)
}

func bindEnvVars() {
	// Server
	viper.BindEnv("server.host", "SERVER_HOST")
	viper.BindEnv("server.port", "SERVER_PORT", "PORT")
	viper.BindEnv("server.environment", "ENVIRONMENT", "ENV")
	viper.BindEnv("server.service_name", "SERVICE_NAME")

	// Database
	viper.BindEnv("database.host", "POSTGRES_HOST", "DB_HOST")
	viper.BindEnv("database.port", "POSTGRES_PORT", "DB_PORT")
	viper.BindEnv("database.user", "POSTGRES_USER", "DB_USER")
	viper.BindEnv("database.password", "POSTGRES_PASSWORD", "DB_PASSWORD")
	viper.BindEnv("database.dbname", "POSTGRES_DB", "DB_NAME")
	viper.BindEnv("database.sslmode", "POSTGRES_SSLMODE", "DB_SSLMODE")

	// Redis
	viper.BindEnv("redis.host", "REDIS_HOST")
	viper.BindEnv("redis.port", "REDIS_PORT")
	viper.BindEnv("redis.password", "REDIS_PASSWORD")

	// Kafka
	viper.BindEnv("kafka.brokers", "KAFKA_BROKERS")
	viper.BindEnv("kafka.consumer_group", "KAFKA_CONSUMER_GROUP")

	// JWT
	viper.BindEnv("jwt.secret", "JWT_SECRET")
	viper.BindEnv("jwt.access_expiry", "JWT_ACCESS_EXPIRY")
	viper.BindEnv("jwt.refresh_expiry", "JWT_REFRESH_EXPIRY")

	// AWS
	viper.BindEnv("aws.region", "AWS_REGION")
	viper.BindEnv("aws.access_key_id", "AWS_ACCESS_KEY_ID")
	viper.BindEnv("aws.secret_access_key", "AWS_SECRET_ACCESS_KEY")
	viper.BindEnv("aws.s3_bucket", "AWS_BUCKET", "AWS_S3_BUCKET")

	// Telemetry
	viper.BindEnv("telemetry.enabled", "TELEMETRY_ENABLED")
	viper.BindEnv("telemetry.otlp_endpoint", "OTEL_EXPORTER_OTLP_ENDPOINT")
	viper.BindEnv("telemetry.service_name", "OTEL_SERVICE_NAME")
	viper.BindEnv("telemetry.environment", "OTEL_ENVIRONMENT")
}

// DSN returns the database connection string
func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}

// Addr returns the Redis address
func (c *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
