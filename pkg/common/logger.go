package common

import (
	"os"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	logger *zap.Logger
	once   sync.Once
)

// InitLogger initializes the global logger
func InitLogger(serviceName, environment string) *zap.Logger {
	once.Do(func() {
		var config zap.Config

		if environment == "production" {
			config = zap.NewProductionConfig()
			config.EncoderConfig.TimeKey = "timestamp"
			config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		} else {
			config = zap.NewDevelopmentConfig()
			config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		}

		config.InitialFields = map[string]interface{}{
			"service": serviceName,
		}

		var err error
		logger, err = config.Build(
			zap.AddCaller(),
			zap.AddStacktrace(zapcore.ErrorLevel),
		)
		if err != nil {
			panic(err)
		}
	})

	return logger
}

// GetLogger returns the global logger
func GetLogger() *zap.Logger {
	if logger == nil {
		return InitLogger("udagram", os.Getenv("ENVIRONMENT"))
	}
	return logger
}

// Logger returns a sugared logger for convenience
func Logger() *zap.SugaredLogger {
	return GetLogger().Sugar()
}

// WithFields returns a logger with additional fields
func WithFields(fields ...zap.Field) *zap.Logger {
	return GetLogger().With(fields...)
}

// WithRequestID returns a logger with request ID field
func WithRequestID(requestID string) *zap.Logger {
	return GetLogger().With(zap.String("request_id", requestID))
}

// WithUserID returns a logger with user ID field
func WithUserID(userID string) *zap.Logger {
	return GetLogger().With(zap.String("user_id", userID))
}

// Sync flushes any buffered log entries
func Sync() error {
	if logger != nil {
		return logger.Sync()
	}
	return nil
}
