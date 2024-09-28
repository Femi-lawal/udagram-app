#!/bin/bash
set -e

# Health check script for all services
echo "🏥 Running health checks..."

GATEWAY_URL=${GATEWAY_URL:-"http://localhost:8080"}
AUTH_URL=${AUTH_URL:-"http://localhost:8081"}
FEED_URL=${FEED_URL:-"http://localhost:8082"}
NOTIFICATION_URL=${NOTIFICATION_URL:-"http://localhost:8083"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    local name=$1
    local url=$2
    local endpoint=${3:-"/health"}
    
    printf "Checking %-15s ... " "$name"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url$endpoint" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    elif [ "$response" = "000" ]; then
        echo -e "${RED}❌ UNREACHABLE${NC}"
        return 1
    else
        echo -e "${YELLOW}⚠️  HTTP $response${NC}"
        return 1
    fi
}

echo ""
echo "Service Health Status"
echo "====================="
echo ""

failed=0

check_service "Gateway" "$GATEWAY_URL" "/health" || ((failed++))
check_service "Auth" "$AUTH_URL" "/health" || ((failed++))
check_service "Feed" "$FEED_URL" "/health" || ((failed++))
check_service "Notification" "$NOTIFICATION_URL" "/health" || ((failed++))

echo ""
echo "Readiness Checks"
echo "================"
echo ""

check_service "Gateway" "$GATEWAY_URL" "/ready" || ((failed++))
check_service "Auth" "$AUTH_URL" "/ready" || ((failed++))
check_service "Feed" "$FEED_URL" "/ready" || ((failed++))
check_service "Notification" "$NOTIFICATION_URL" "/ready" || ((failed++))

echo ""
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}❌ $failed health check(s) failed${NC}"
    exit 1
fi
