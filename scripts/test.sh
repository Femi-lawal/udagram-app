#!/bin/bash
set -e

# Run all tests with coverage
echo "🧪 Running tests..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Run tests
echo "Running unit tests..."
go test -v -race -coverprofile=coverage.out -covermode=atomic ./...

# Generate coverage report
echo ""
echo "📊 Coverage Report:"
go tool cover -func=coverage.out

# Get total coverage percentage
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')

echo ""
if (( $(echo "$COVERAGE >= 80" | bc -l) )); then
    echo -e "${GREEN}✅ Coverage: $COVERAGE% (meets 80% threshold)${NC}"
else
    echo -e "${RED}❌ Coverage: $COVERAGE% (below 80% threshold)${NC}"
fi

# Generate HTML coverage report
echo ""
echo "📄 Generating HTML coverage report..."
go tool cover -html=coverage.out -o coverage.html
echo "✅ Coverage report saved to coverage.html"

# Run integration tests if flag is set
if [ "$INTEGRATION" = "true" ]; then
    echo ""
    echo "🔗 Running integration tests..."
    go test -v -tags=integration ./tests/integration/...
fi

echo ""
echo "🎉 Tests completed!"
