package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func generateTestToken(secret string, claims jwt.MapClaims) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, _ := token.SignedString([]byte(secret))
	return signedToken
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	secret := "test-secret"
	claims := jwt.MapClaims{
		"sub":   "user-123",
		"email": "test@example.com",
		"exp":   float64(9999999999),
	}
	token := generateTestToken(secret, claims)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := Auth(secret)
	middleware(c)

	assert.False(t, c.IsAborted())
	assert.Equal(t, "user-123", c.GetString("user_id"))
	assert.Equal(t, "test@example.com", c.GetString("email"))
}

func TestAuthMiddleware_MissingToken(t *testing.T) {
	secret := "test-secret"

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	middleware := Auth(secret)
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	secret := "test-secret"

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer invalid-token")

	middleware := Auth(secret)
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_WrongSecret(t *testing.T) {
	claims := jwt.MapClaims{
		"sub":   "user-123",
		"email": "test@example.com",
		"exp":   float64(9999999999),
	}
	token := generateTestToken("correct-secret", claims)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := Auth("wrong-secret")
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_ExpiredToken(t *testing.T) {
	secret := "test-secret"
	claims := jwt.MapClaims{
		"sub":   "user-123",
		"email": "test@example.com",
		"exp":   float64(1), // Expired timestamp
	}
	token := generateTestToken(secret, claims)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := Auth(secret)
	middleware(c)

	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_MalformedHeader(t *testing.T) {
	tests := []struct {
		name   string
		header string
	}{
		{"no bearer prefix", "some-token"},
		{"empty bearer", "Bearer "},
		{"wrong prefix", "Basic some-token"},
	}

	secret := "test-secret"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/", nil)
			c.Request.Header.Set("Authorization", tt.header)

			middleware := Auth(secret)
			middleware(c)

			assert.True(t, c.IsAborted())
			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}

func TestOptionalAuth_WithToken(t *testing.T) {
	secret := "test-secret"
	claims := jwt.MapClaims{
		"sub":   "user-123",
		"email": "test@example.com",
		"exp":   float64(9999999999),
	}
	token := generateTestToken(secret, claims)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer "+token)

	middleware := OptionalAuth(secret)
	middleware(c)

	assert.False(t, c.IsAborted())
	assert.Equal(t, "user-123", c.GetString("user_id"))
}

func TestOptionalAuth_WithoutToken(t *testing.T) {
	secret := "test-secret"

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)

	middleware := OptionalAuth(secret)
	middleware(c)

	assert.False(t, c.IsAborted())
	assert.Empty(t, c.GetString("user_id"))
}

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		name        string
		header      string
		expected    string
		expectError bool
	}{
		{
			name:        "valid bearer token",
			header:      "Bearer valid-token",
			expected:    "valid-token",
			expectError: false,
		},
		{
			name:        "empty header",
			header:      "",
			expected:    "",
			expectError: true,
		},
		{
			name:        "no bearer prefix",
			header:      "some-token",
			expected:    "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := extractBearerToken(tt.header)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, token)
			}
		})
	}
}
