package common

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig(t *testing.T) {
	// Set up test environment variables
	os.Setenv("SERVER_HOST", "localhost")
	os.Setenv("SERVER_PORT", "9999")
	os.Setenv("DATABASE_HOST", "testdb")
	os.Setenv("DATABASE_PORT", "5433")
	os.Setenv("DATABASE_USER", "testuser")
	os.Setenv("DATABASE_PASSWORD", "testpass")
	os.Setenv("DATABASE_NAME", "testdb")
	os.Setenv("JWT_SECRET", "testsecret")
	defer func() {
		os.Unsetenv("SERVER_HOST")
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("DATABASE_HOST")
		os.Unsetenv("DATABASE_PORT")
		os.Unsetenv("DATABASE_USER")
		os.Unsetenv("DATABASE_PASSWORD")
		os.Unsetenv("DATABASE_NAME")
		os.Unsetenv("JWT_SECRET")
	}()

	cfg, err := LoadConfig()
	require.NoError(t, err)

	assert.Equal(t, "localhost", cfg.Server.Host)
	assert.Equal(t, 9999, cfg.Server.Port)
	assert.Equal(t, "testdb", cfg.Database.Host)
	assert.Equal(t, 5433, cfg.Database.Port)
	assert.Equal(t, "testuser", cfg.Database.User)
	assert.Equal(t, "testpass", cfg.Database.Password)
	assert.Equal(t, "testdb", cfg.Database.Name)
	assert.Equal(t, "testsecret", cfg.JWT.Secret)
}

func TestConfigDefaults(t *testing.T) {
	// Clear all environment variables
	os.Clearenv()
	os.Setenv("JWT_SECRET", "required_secret")
	defer os.Unsetenv("JWT_SECRET")

	cfg, err := LoadConfig()
	require.NoError(t, err)

	// Check defaults
	assert.Equal(t, "0.0.0.0", cfg.Server.Host)
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, "localhost", cfg.Database.Host)
	assert.Equal(t, 5432, cfg.Database.Port)
	assert.Equal(t, "postgres", cfg.Database.User)
	assert.Equal(t, "udagram", cfg.Database.Name)
	assert.Equal(t, "localhost:6379", cfg.Redis.Address)
	assert.Equal(t, "localhost:9092", cfg.Kafka.Brokers)
	assert.Equal(t, 24, cfg.JWT.ExpiryHours)
}

func TestDatabaseDSN(t *testing.T) {
	dbConfig := DatabaseConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "postgres",
		Password: "secret",
		Name:     "testdb",
		SSLMode:  "disable",
	}

	expectedDSN := "host=localhost port=5432 user=postgres password=secret dbname=testdb sslmode=disable"
	assert.Equal(t, expectedDSN, dbConfig.DSN())
}

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name        string
		setupEnv    func()
		expectError bool
	}{
		{
			name: "valid config",
			setupEnv: func() {
				os.Setenv("JWT_SECRET", "valid_secret")
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Clearenv()
			tt.setupEnv()

			_, err := LoadConfig()
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
