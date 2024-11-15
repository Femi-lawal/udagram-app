package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestJWTMiddleware_ValidToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		Audience:     "udagram-users",
		AccessExpiry: time.Hour,
	}

	// Generate a valid token
	token, err := GenerateAccessToken(config, "user-123", "test@example.com")
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := JWTMiddleware(config)
	middleware(c)

	assert.False(t, c.IsAborted())
	assert.Equal(t, "user-123", c.GetString("user_id"))
	assert.Equal(t, "test@example.com", c.GetString("email"))
}

func TestJWTMiddleware_MissingToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		AccessExpiry: time.Hour,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	middleware := JWTMiddleware(config)
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTMiddleware_InvalidToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		AccessExpiry: time.Hour,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer invalid-token")

	middleware := JWTMiddleware(config)
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTMiddleware_WrongSecret(t *testing.T) {
	config := JWTConfig{
		Secret:       "correct-secret",
		Issuer:       "udagram",
		AccessExpiry: time.Hour,
	}

	token, err := GenerateAccessToken(config, "user-123", "test@example.com")
	require.NoError(t, err)

	wrongConfig := JWTConfig{
		Secret:       "wrong-secret",
		Issuer:       "udagram",
		AccessExpiry: time.Hour,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := JWTMiddleware(wrongConfig)
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestOptionalJWTMiddleware_WithToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		Audience:     "udagram-users",
		AccessExpiry: time.Hour,
	}

	token, err := GenerateAccessToken(config, "user-123", "test@example.com")
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := OptionalJWTMiddleware(config)
	middleware(c)

	assert.False(t, c.IsAborted())
	assert.Equal(t, "user-123", c.GetString("user_id"))
}

func TestOptionalJWTMiddleware_WithoutToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		AccessExpiry: time.Hour,
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	middleware := OptionalJWTMiddleware(config)
	middleware(c)

	assert.False(t, c.IsAborted())
	assert.Empty(t, c.GetString("user_id"))
}

func TestGenerateAccessToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		Audience:     "udagram-users",
		AccessExpiry: time.Hour,
	}

	token, err := GenerateAccessToken(config, "user-123", "test@example.com")
	require.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestValidateToken(t *testing.T) {
	config := JWTConfig{
		Secret:       "test-secret",
		Issuer:       "udagram",
		Audience:     "udagram-users",
		AccessExpiry: time.Hour,
	}

	token, err := GenerateAccessToken(config, "user-123", "test@example.com")
	require.NoError(t, err)

	claims, err := ValidateToken(config, token)
	require.NoError(t, err)
	assert.Equal(t, "user-123", claims.UserID)
	assert.Equal(t, "test@example.com", claims.Email)
}

func TestGetUserIDFromContext(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user_id", "user-123")

	userID, exists := GetUserIDFromContext(c)
	assert.True(t, exists)
	assert.Equal(t, "user-123", userID)
}

func TestGetUserIDFromContext_NotExists(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	userID, exists := GetUserIDFromContext(c)
	assert.False(t, exists)
	assert.Empty(t, userID)
}
