#!/bin/bash
set -e

# Build all services
echo "🔨 Building all services..."

# Services to build
SERVICES=("gateway" "auth" "feed" "notification")

# Build flags
LDFLAGS="-w -s -X main.Version=$(git describe --tags --always --dirty 2>/dev/null || echo 'dev') -X main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Output directory
mkdir -p bin

for service in "${SERVICES[@]}"; do
    echo "📦 Building $service..."
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
        -ldflags="$LDFLAGS" \
        -o "bin/$service" \
        "./services/$service"
    echo "✅ $service built successfully"
done

echo ""
echo "🎉 All services built successfully!"
echo "📁 Binaries are in the ./bin directory"
ls -la bin/
