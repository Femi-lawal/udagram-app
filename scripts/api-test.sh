#!/bin/bash

# API test script using curl
set -e

BASE_URL=${BASE_URL:-"http://localhost:8080"}
AUTH_TOKEN=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

print_success() {
    echo -e "${GREEN}   ✅ $1${NC}"
}

print_error() {
    echo -e "${RED}   ❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}   ℹ️  $1${NC}"
}

# Generate random email for testing
RANDOM_EMAIL="test$(date +%s)@example.com"
PASSWORD="TestPassword123!"

echo ""
echo "================================"
echo "   Udagram API Test Suite"
echo "================================"
echo ""
echo "Base URL: $BASE_URL"
echo "Test Email: $RANDOM_EMAIL"
echo ""

# Test 1: Health Check
print_test "Testing health endpoint..."
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$status" = "200" ]; then
    print_success "Health check passed"
else
    print_error "Health check failed (HTTP $status)"
    exit 1
fi

# Test 2: Ready Check
print_test "Testing readiness endpoint..."
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/ready")
status=$(echo "$response" | tail -n1)

if [ "$status" = "200" ]; then
    print_success "Readiness check passed"
else
    print_error "Readiness check failed (HTTP $status)"
fi

# Test 3: User Registration
print_test "Testing user registration..."
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v0/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$PASSWORD\"}")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$status" = "201" ]; then
    print_success "User registration passed"
    print_info "Response: $body"
else
    print_error "User registration failed (HTTP $status)"
    print_info "Response: $body"
fi

# Test 4: User Login
print_test "Testing user login..."
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v0/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$PASSWORD\"}")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$status" = "200" ]; then
    print_success "User login passed"
    AUTH_TOKEN=$(echo "$body" | jq -r '.data.token // .token // empty' 2>/dev/null || echo "")
    if [ -n "$AUTH_TOKEN" ]; then
        print_info "Token received: ${AUTH_TOKEN:0:20}..."
    fi
else
    print_error "User login failed (HTTP $status)"
    print_info "Response: $body"
fi

# Test 5: Get Feed (Unauthenticated)
print_test "Testing feed endpoint (unauthenticated)..."
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v0/feed")
status=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$status" = "200" ]; then
    print_success "Get feed passed (unauthenticated)"
elif [ "$status" = "401" ]; then
    print_info "Get feed requires authentication (expected)"
else
    print_error "Get feed failed (HTTP $status)"
fi

# Test 6: Get Feed (Authenticated)
if [ -n "$AUTH_TOKEN" ]; then
    print_test "Testing feed endpoint (authenticated)..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v0/feed" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status" = "200" ]; then
        print_success "Get feed passed (authenticated)"
        print_info "Response: $body"
    else
        print_error "Get feed failed (HTTP $status)"
        print_info "Response: $body"
    fi
fi

# Test 7: Create Feed Item
if [ -n "$AUTH_TOKEN" ]; then
    print_test "Testing create feed item..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v0/feed" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"caption":"Test post from API test suite","url":"https://example.com/test.jpg"}')
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status" = "201" ] || [ "$status" = "200" ]; then
        print_success "Create feed item passed"
        FEED_ID=$(echo "$body" | jq -r '.data.id // .id // empty' 2>/dev/null || echo "")
        print_info "Created feed item: $FEED_ID"
    else
        print_error "Create feed item failed (HTTP $status)"
        print_info "Response: $body"
    fi
fi

# Test 8: Get Upload URL
if [ -n "$AUTH_TOKEN" ]; then
    print_test "Testing get signed URL..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v0/feed/signed-url/test.jpg" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status" = "200" ]; then
        print_success "Get signed URL passed"
    elif [ "$status" = "501" ] || [ "$status" = "500" ]; then
        print_info "Signed URL not configured (S3 not set up)"
    else
        print_error "Get signed URL failed (HTTP $status)"
    fi
fi

# Test 9: Rate Limiting
print_test "Testing rate limiting..."
rate_limited=false
for i in {1..50}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
    if [ "$response" = "429" ]; then
        rate_limited=true
        print_success "Rate limiting working (triggered at request $i)"
        break
    fi
done

if [ "$rate_limited" = false ]; then
    print_info "Rate limiting not triggered in 50 requests"
fi

# Test 10: Invalid Token
print_test "Testing invalid token..."
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v0/feed" \
    -H "Authorization: Bearer invalid-token")
status=$(echo "$response" | tail -n1)

if [ "$status" = "401" ]; then
    print_success "Invalid token rejected correctly"
else
    print_error "Invalid token not rejected (HTTP $status)"
fi

# Test 11: Metrics endpoint
print_test "Testing metrics endpoint..."
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/metrics")
status=$(echo "$response" | tail -n1)

if [ "$status" = "200" ]; then
    print_success "Metrics endpoint working"
else
    print_info "Metrics endpoint returned HTTP $status"
fi

echo ""
echo "================================"
echo "   Test Suite Complete"
echo "================================"
echo ""
