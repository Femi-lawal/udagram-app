#!/bin/bash
set -e

# Docker build and push script
REGISTRY=${DOCKER_REGISTRY:-"docker.io"}
USERNAME=${DOCKER_USERNAME:-"femilawal"}
TAG=${TAG:-"latest"}

SERVICES=("gateway" "auth" "feed" "notification")

echo "🐳 Building Docker images..."
echo "Registry: $REGISTRY"
echo "Username: $USERNAME"
echo "Tag: $TAG"
echo ""

for service in "${SERVICES[@]}"; do
    IMAGE="$REGISTRY/$USERNAME/udagram-$service:$TAG"
    echo "📦 Building $service..."
    
    docker build \
        --build-arg VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo 'dev') \
        --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
        -t "$IMAGE" \
        -f "services/$service/Dockerfile" \
        .
    
    echo "✅ Built $IMAGE"
done

echo ""
echo "🎉 All images built successfully!"
echo ""

# Push if requested
if [ "$PUSH" = "true" ]; then
    echo "📤 Pushing images to registry..."
    for service in "${SERVICES[@]}"; do
        IMAGE="$REGISTRY/$USERNAME/udagram-$service:$TAG"
        echo "Pushing $IMAGE..."
        docker push "$IMAGE"
    done
    echo "✅ All images pushed successfully!"
fi
