#!/bin/bash
set -e

# Deploy to Kubernetes cluster
echo "🚀 Deploying to Kubernetes..."

NAMESPACE=${NAMESPACE:-"udagram"}
ENVIRONMENT=${ENVIRONMENT:-"development"}

echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

# Check cluster connection
echo "Checking cluster connection..."
kubectl cluster-info > /dev/null 2>&1 || {
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
}
echo "✅ Connected to cluster"
echo ""

# Apply manifests in order
echo "Applying Kubernetes manifests..."

# 1. Namespace
echo "Creating namespace..."
kubectl apply -f infrastructure/kubernetes/namespace.yaml

# 2. ConfigMaps and Secrets
echo "Applying configuration..."
kubectl apply -f infrastructure/kubernetes/configmap.yaml
kubectl apply -f infrastructure/kubernetes/secrets.yaml

# 3. RBAC
echo "Applying RBAC..."
kubectl apply -f infrastructure/kubernetes/rbac.yaml

# 4. Databases (if deploying with in-cluster databases)
if [ "$DEPLOY_DBS" = "true" ]; then
    echo "Deploying databases..."
    kubectl apply -f infrastructure/kubernetes/databases.yaml
    kubectl apply -f infrastructure/kubernetes/kafka.yaml
fi

# 5. Services
echo "Deploying services..."
kubectl apply -f infrastructure/kubernetes/gateway.yaml
kubectl apply -f infrastructure/kubernetes/auth.yaml
kubectl apply -f infrastructure/kubernetes/feed.yaml
kubectl apply -f infrastructure/kubernetes/notification.yaml

# 6. Network policies
echo "Applying network policies..."
kubectl apply -f infrastructure/kubernetes/network-policies.yaml

# 7. Ingress
echo "Applying ingress..."
kubectl apply -f infrastructure/kubernetes/ingress.yaml

echo ""
echo "⏳ Waiting for deployments to be ready..."

# Wait for deployments
kubectl rollout status deployment/gateway -n "$NAMESPACE" --timeout=300s
kubectl rollout status deployment/auth -n "$NAMESPACE" --timeout=300s
kubectl rollout status deployment/feed -n "$NAMESPACE" --timeout=300s
kubectl rollout status deployment/notification -n "$NAMESPACE" --timeout=300s

echo ""
echo "✅ All deployments are ready!"
echo ""

# Show status
echo "📊 Deployment Status:"
kubectl get pods -n "$NAMESPACE"
echo ""
kubectl get services -n "$NAMESPACE"
echo ""
kubectl get ingress -n "$NAMESPACE"

echo ""
echo "🎉 Deployment completed successfully!"
