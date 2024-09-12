// +build integration

package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type APITestSuite struct {
	suite.Suite
	baseURL   string
	authToken string
	userEmail string
}

func (s *APITestSuite) SetupSuite() {
	s.baseURL = os.Getenv("API_BASE_URL")
	if s.baseURL == "" {
		s.baseURL = "http://localhost:8080"
	}
	s.userEmail = fmt.Sprintf("test_%d@example.com", time.Now().UnixNano())

	// Wait for services to be ready
	s.waitForServices()
}

func (s *APITestSuite) waitForServices() {
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		resp, err := http.Get(s.baseURL + "/health")
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			return
		}
		time.Sleep(time.Second)
	}
	s.T().Fatal("Services did not become ready in time")
}

func (s *APITestSuite) TestHealthEndpoint() {
	resp, err := http.Get(s.baseURL + "/health")
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
}

func (s *APITestSuite) TestReadyEndpoint() {
	resp, err := http.Get(s.baseURL + "/ready")
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
}

func (s *APITestSuite) TestUserRegistration() {
	payload := map[string]string{
		"email":    s.userEmail,
		"password": "TestPassword123!",
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(
		s.baseURL+"/api/v0/auth/register",
		"application/json",
		bytes.NewReader(body),
	)
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusCreated, resp.StatusCode)
}

func (s *APITestSuite) TestUserLogin() {
	payload := map[string]string{
		"email":    s.userEmail,
		"password": "TestPassword123!",
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(
		s.baseURL+"/api/v0/auth/login",
		"application/json",
		bytes.NewReader(body),
	)
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if data, ok := result["data"].(map[string]interface{}); ok {
		s.authToken = data["token"].(string)
	} else if token, ok := result["token"].(string); ok {
		s.authToken = token
	}

	assert.NotEmpty(s.T(), s.authToken)
}

func (s *APITestSuite) TestGetFeedUnauthenticated() {
	resp, err := http.Get(s.baseURL + "/api/v0/feed")
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	// Depending on configuration, this might be 200 or 401
	assert.Contains(s.T(), []int{http.StatusOK, http.StatusUnauthorized}, resp.StatusCode)
}

func (s *APITestSuite) TestGetFeedAuthenticated() {
	if s.authToken == "" {
		s.T().Skip("No auth token available")
	}

	req, _ := http.NewRequest("GET", s.baseURL+"/api/v0/feed", nil)
	req.Header.Set("Authorization", "Bearer "+s.authToken)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
}

func (s *APITestSuite) TestCreateFeedItem() {
	if s.authToken == "" {
		s.T().Skip("No auth token available")
	}

	payload := map[string]string{
		"caption": "Integration test post",
		"url":     "https://example.com/test.jpg",
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", s.baseURL+"/api/v0/feed", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+s.authToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Contains(s.T(), []int{http.StatusOK, http.StatusCreated}, resp.StatusCode)
}

func (s *APITestSuite) TestInvalidToken() {
	req, _ := http.NewRequest("GET", s.baseURL+"/api/v0/feed", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusUnauthorized, resp.StatusCode)
}

func (s *APITestSuite) TestMissingToken() {
	req, _ := http.NewRequest("POST", s.baseURL+"/api/v0/feed", nil)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusUnauthorized, resp.StatusCode)
}

func (s *APITestSuite) TestMetricsEndpoint() {
	resp, err := http.Get(s.baseURL + "/metrics")
	require.NoError(s.T(), err)
	defer resp.Body.Close()

	// Metrics endpoint might not be exposed through gateway
	assert.Contains(s.T(), []int{http.StatusOK, http.StatusNotFound}, resp.StatusCode)
}

func TestAPITestSuite(t *testing.T) {
	suite.Run(t, new(APITestSuite))
}
