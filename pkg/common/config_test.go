package common

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	// Set up test environment variables
	require.NoError(t, os.Setenv("SERVER_HOST", "localhost"))
	require.NoError(t, os.Setenv("SERVER_PORT", "9999"))
	require.NoError(t, os.Setenv("POSTGRES_HOST", "testdb"))
	require.NoError(t, os.Setenv("POSTGRES_PORT", "5433"))
	require.NoError(t, os.Setenv("POSTGRES_USER", "testuser"))
	require.NoError(t, os.Setenv("POSTGRES_PASSWORD", "testpass"))
	require.NoError(t, os.Setenv("POSTGRES_DB", "testdb"))
	require.NoError(t, os.Setenv("JWT_SECRET", "testsecret"))
	defer func() {
		_ = os.Unsetenv("SERVER_HOST")
		_ = os.Unsetenv("SERVER_PORT")
		_ = os.Unsetenv("POSTGRES_HOST")
		_ = os.Unsetenv("POSTGRES_PORT")
		_ = os.Unsetenv("POSTGRES_USER")
		_ = os.Unsetenv("POSTGRES_PASSWORD")
		_ = os.Unsetenv("POSTGRES_DB")
		_ = os.Unsetenv("JWT_SECRET")
	}()

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "localhost", cfg.Server.Host)
	assert.Equal(t, 9999, cfg.Server.Port)
	assert.Equal(t, "testdb", cfg.Database.Host)
	assert.Equal(t, 5433, cfg.Database.Port)
	assert.Equal(t, "testuser", cfg.Database.User)
	assert.Equal(t, "testpass", cfg.Database.Password)
	assert.Equal(t, "testdb", cfg.Database.DBName)
	assert.Equal(t, "testsecret", cfg.JWT.Secret)
}

func TestConfigDefaults(t *testing.T) {
	// Clear all environment variables
	os.Clearenv()

	cfg, err := Load()
	require.NoError(t, err)

	// Check defaults
	assert.Equal(t, "0.0.0.0", cfg.Server.Host)
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, "localhost", cfg.Database.Host)
	assert.Equal(t, 5432, cfg.Database.Port)
	assert.Equal(t, "udagram", cfg.Database.User)
	assert.Equal(t, "udagram", cfg.Database.DBName)
	assert.Equal(t, "localhost", cfg.Redis.Host)
	assert.Equal(t, 6379, cfg.Redis.Port)
}

func TestDatabaseDSN(t *testing.T) {
	dbConfig := DatabaseConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "postgres",
		Password: "secret",
		DBName:   "testdb",
		SSLMode:  "disable",
	}

	expectedDSN := "host=localhost port=5432 user=postgres password=secret dbname=testdb sslmode=disable"
	assert.Equal(t, expectedDSN, dbConfig.DSN())
}

func TestRedisAddr(t *testing.T) {
	redisConfig := RedisConfig{
		Host: "localhost",
		Port: 6379,
	}

	assert.Equal(t, "localhost:6379", redisConfig.Addr())
}
