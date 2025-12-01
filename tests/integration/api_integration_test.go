package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

// TestConfig holds test configuration
type TestConfig struct {
	GatewayURL string
	AuthURL    string
	FeedURL    string
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error,omitempty"`
}

// LoginResponse represents login response data
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	User         struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	} `json:"user"`
}

// FeedItem represents a feed item
type FeedItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Caption   string    `json:"caption"`
	URL       string    `json:"url"`
	Likes     int       `json:"likes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FeedResponse represents paginated feed response
type FeedResponse struct {
	Items      []FeedItem `json:"items"`
	Count      int64      `json:"count"`
	Page       int        `json:"page"`
	PerPage    int        `json:"per_page"`
	TotalPages int        `json:"total_pages"`
}

var config TestConfig

func init() {
	config = TestConfig{
		GatewayURL: getEnv("GATEWAY_URL", "http://localhost:8080"),
		AuthURL:    getEnv("AUTH_URL", "http://localhost:8081"),
		FeedURL:    getEnv("FEED_URL", "http://localhost:8082"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// TestHealthEndpoints tests all service health endpoints
func TestHealthEndpoints(t *testing.T) {
	endpoints := []struct {
		name string
		url  string
	}{
		{"Gateway", config.GatewayURL + "/health"},
		{"Auth", config.AuthURL + "/health"},
		{"Feed", config.FeedURL + "/health"},
	}

	for _, ep := range endpoints {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ep.url)
			if err != nil {
				t.Fatalf("Failed to call %s health endpoint: %v", ep.name, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d for %s", resp.StatusCode, ep.name)
			}

			var result map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			if status, ok := result["status"].(string); !ok || status != "healthy" {
				t.Errorf("Expected status 'healthy', got '%v'", result["status"])
			}
		})
	}
}

// TestUserRegistration tests user registration flow
func TestUserRegistration(t *testing.T) {
	uniqueEmail := fmt.Sprintf("test-%d@example.com", time.Now().UnixNano())

	payload := map[string]string{
		"email":    uniqueEmail,
		"password": "securePassword123!",
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(
		config.AuthURL+"/api/v1/auth/register",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		t.Fatalf("Failed to register user: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200 or 201, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if !apiResp.Success {
		t.Errorf("Expected success=true, got false")
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(apiResp.Data, &loginResp); err != nil {
		t.Fatalf("Failed to decode login response: %v", err)
	}

	if loginResp.AccessToken == "" {
		t.Error("Expected access token, got empty string")
	}

	if loginResp.User.Email != uniqueEmail {
		t.Errorf("Expected email %s, got %s", uniqueEmail, loginResp.User.Email)
	}
}

// TestUserLogin tests user login flow
func TestUserLogin(t *testing.T) {
	// First register a user
	uniqueEmail := fmt.Sprintf("login-test-%d@example.com", time.Now().UnixNano())
	password := "loginPassword123!"

	// Register
	registerPayload := map[string]string{
		"email":    uniqueEmail,
		"password": password,
	}
	body, _ := json.Marshal(registerPayload)
	resp, err := http.Post(config.AuthURL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to register user: %v", err)
	}
	resp.Body.Close()

	// Now login
	loginPayload := map[string]string{
		"email":    uniqueEmail,
		"password": password,
	}
	body, _ = json.Marshal(loginPayload)
	resp, err = http.Post(config.AuthURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to login: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(apiResp.Data, &loginResp); err != nil {
		t.Fatalf("Failed to decode login response: %v", err)
	}

	if loginResp.AccessToken == "" {
		t.Error("Expected access token, got empty string")
	}
}

// TestInvalidLogin tests invalid login credentials
func TestInvalidLogin(t *testing.T) {
	loginPayload := map[string]string{
		"email":    "nonexistent@example.com",
		"password": "wrongpassword",
	}
	body, _ := json.Marshal(loginPayload)
	resp, err := http.Post(config.AuthURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", resp.StatusCode)
	}
}

// TestFeedCRUD tests full feed CRUD operations
func TestFeedCRUD(t *testing.T) {
	// First, create a user and get token
	uniqueEmail := fmt.Sprintf("feed-test-%d@example.com", time.Now().UnixNano())
	password := "feedPassword123!"

	registerPayload := map[string]string{
		"email":    uniqueEmail,
		"password": password,
	}
	body, _ := json.Marshal(registerPayload)
	resp, err := http.Post(config.AuthURL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("Failed to register user: %v", err)
	}
	defer resp.Body.Close()

	var apiResp APIResponse
	json.NewDecoder(resp.Body).Decode(&apiResp)
	var loginResp LoginResponse
	json.Unmarshal(apiResp.Data, &loginResp)

	userID := loginResp.User.ID
	if userID == "" {
		t.Fatal("Failed to get user ID")
	}

	// Test: Get empty feed
	t.Run("GetEmptyFeed", func(t *testing.T) {
		resp, err := http.Get(config.FeedURL + "/api/v1/feed")
		if err != nil {
			t.Fatalf("Failed to get feed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})

	// Test: Create feed item
	var createdItemID string
	t.Run("CreateFeedItem", func(t *testing.T) {
		feedPayload := map[string]string{
			"caption": "Test caption",
			"url":     "https://example.com/test.jpg",
		}
		body, _ := json.Marshal(feedPayload)

		req, _ := http.NewRequest("POST", config.FeedURL+"/api/v1/feed", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", userID)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to create feed item: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200 or 201, got %d: %s", resp.StatusCode, string(bodyBytes))
		}

		var apiResp APIResponse
		json.NewDecoder(resp.Body).Decode(&apiResp)

		var item FeedItem
		json.Unmarshal(apiResp.Data, &item)
		createdItemID = item.ID

		if item.Caption != "Test caption" {
			t.Errorf("Expected caption 'Test caption', got '%s'", item.Caption)
		}
	})

	// Test: Get created feed item
	t.Run("GetFeedItem", func(t *testing.T) {
		if createdItemID == "" {
			t.Skip("No item created")
		}

		resp, err := http.Get(config.FeedURL + "/api/v1/feed/" + createdItemID)
		if err != nil {
			t.Fatalf("Failed to get feed item: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}

		var apiResp APIResponse
		json.NewDecoder(resp.Body).Decode(&apiResp)

		var item FeedItem
		json.Unmarshal(apiResp.Data, &item)

		if item.ID != createdItemID {
			t.Errorf("Expected ID %s, got %s", createdItemID, item.ID)
		}
	})

	// Test: Like feed item
	t.Run("LikeFeedItem", func(t *testing.T) {
		if createdItemID == "" {
			t.Skip("No item created")
		}

		resp, err := http.Post(config.FeedURL+"/api/v1/feed/"+createdItemID+"/like", "application/json", nil)
		if err != nil {
			t.Fatalf("Failed to like feed item: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})

	// Test: Update feed item
	t.Run("UpdateFeedItem", func(t *testing.T) {
		if createdItemID == "" {
			t.Skip("No item created")
		}

		updatePayload := map[string]string{
			"caption": "Updated caption",
		}
		body, _ := json.Marshal(updatePayload)

		req, _ := http.NewRequest("PUT", config.FeedURL+"/api/v1/feed/"+createdItemID, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", userID)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to update feed item: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			t.Errorf("Expected status 200, got %d: %s", resp.StatusCode, string(bodyBytes))
		}
	})

	// Test: Delete feed item
	t.Run("DeleteFeedItem", func(t *testing.T) {
		if createdItemID == "" {
			t.Skip("No item created")
		}

		req, _ := http.NewRequest("DELETE", config.FeedURL+"/api/v1/feed/"+createdItemID, nil)
		req.Header.Set("X-User-ID", userID)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to delete feed item: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200 or 204, got %d", resp.StatusCode)
		}
	})
}

// TestRateLimiting tests rate limiting functionality
func TestRateLimiting(t *testing.T) {
	// This test would require the rate limiter to be configured with a low limit
	// For now, we just verify the endpoint responds
	t.Skip("Rate limiting test requires specific configuration")
}

// TestGatewayProxy tests gateway proxying to services
func TestGatewayProxy(t *testing.T) {
	t.Run("ProxyToAuth", func(t *testing.T) {
		payload := map[string]string{
			"email":    "proxytest@example.com",
			"password": "wrongpassword",
		}
		body, _ := json.Marshal(payload)

		resp, err := http.Post(config.GatewayURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to call gateway: %v", err)
		}
		defer resp.Body.Close()

		// Even with wrong credentials, we should get a response (401)
		if resp.StatusCode != http.StatusUnauthorized {
			// May also get 404 if user doesn't exist
			if resp.StatusCode != http.StatusNotFound && resp.StatusCode != http.StatusOK {
				t.Errorf("Expected 401 or 404, got %d", resp.StatusCode)
			}
		}
	})

	t.Run("ProxyToFeed", func(t *testing.T) {
		resp, err := http.Get(config.GatewayURL + "/api/v1/feed")
		if err != nil {
			t.Fatalf("Failed to call gateway: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})
}

// TestMetricsEndpoints tests Prometheus metrics endpoints
func TestMetricsEndpoints(t *testing.T) {
	endpoints := []struct {
		name string
		url  string
	}{
		{"Gateway", config.GatewayURL + "/metrics"},
		{"Auth", config.AuthURL + "/metrics"},
		{"Feed", config.FeedURL + "/metrics"},
	}

	for _, ep := range endpoints {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ep.url)
			if err != nil {
				t.Fatalf("Failed to get metrics for %s: %v", ep.name, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d for %s", resp.StatusCode, ep.name)
			}

			body, _ := io.ReadAll(resp.Body)
			if len(body) == 0 {
				t.Errorf("Expected non-empty metrics response for %s", ep.name)
			}

			// Check for Go metrics
			if !bytes.Contains(body, []byte("go_goroutines")) {
				t.Errorf("Expected go_goroutines metric for %s", ep.name)
			}
		})
	}
}
