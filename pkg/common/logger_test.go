package common

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestInitLogger(t *testing.T) {
	tests := []struct {
		name        string
		serviceName string
		environment string
	}{
		{
			name:        "development logger",
			serviceName: "test-service",
			environment: "development",
		},
		{
			name:        "production logger",
			serviceName: "test-service",
			environment: "production",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := InitLogger(tt.serviceName, tt.environment)
			require.NotNil(t, logger)
		})
	}
}

func TestLoggerLevels(t *testing.T) {
	// Create a test logger with buffer
	var buf bytes.Buffer
	encoderConfig := zap.NewProductionEncoderConfig()
	encoder := zapcore.NewJSONEncoder(encoderConfig)
	core := zapcore.NewCore(encoder, zapcore.AddSync(&buf), zapcore.DebugLevel)
	logger := zap.New(core)

	// Test different log levels
	logger.Debug("debug message")
	logger.Info("info message")
	logger.Warn("warn message")
	logger.Error("error message")

	output := buf.String()
	assert.Contains(t, output, "debug message")
	assert.Contains(t, output, "info message")
	assert.Contains(t, output, "warn message")
	assert.Contains(t, output, "error message")
}

func TestLoggerWithFields(t *testing.T) {
	var buf bytes.Buffer
	encoderConfig := zap.NewProductionEncoderConfig()
	encoder := zapcore.NewJSONEncoder(encoderConfig)
	core := zapcore.NewCore(encoder, zapcore.AddSync(&buf), zapcore.DebugLevel)
	logger := zap.New(core)

	logger.Info("test message",
		zap.String("user_id", "123"),
		zap.Int("status_code", 200),
		zap.Bool("success", true),
	)

	output := buf.String()
	assert.Contains(t, output, "user_id")
	assert.Contains(t, output, "123")
	assert.Contains(t, output, "status_code")
	assert.Contains(t, output, "200")
	assert.Contains(t, output, "success")
}
