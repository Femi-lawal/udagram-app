# Deployment Runbook

## Pre-Deployment Checklist

### 1. Code Review Completed

- [ ] All PRs merged and approved
- [ ] Tests passing in CI/CD
- [ ] Security scan completed
- [ ] Performance tests passed

### 2. Infrastructure Ready

- [ ] Database migrations reviewed
- [ ] Config changes documented
- [ ] Rollback plan documented
- [ ] Monitoring dashboards ready

### 3. Communication

- [ ] Team notified of deployment window
- [ ] Stakeholders informed
- [ ] On-call engineer available

## Deployment Methods

### Method 1: Rolling Deployment (Default)

```bash
# Build new images
docker-compose build

# Pull latest images
docker-compose pull

# Rolling restart (one service at a time)
docker-compose up -d --no-deps gateway
sleep 30
docker-compose up -d --no-deps auth
sleep 30
docker-compose up -d --no-deps feed
sleep 30
docker-compose up -d --no-deps notification
```

### Method 2: Blue-Green Deployment (Kubernetes)

```bash
# Deploy new version alongside current
kubectl apply -f kubernetes/deployment-blue.yaml

# Wait for new pods to be ready
kubectl rollout status deployment/gateway-blue

# Switch traffic to new version
kubectl patch service gateway -p '{"spec":{"selector":{"version":"blue"}}}'

# Verify health
curl http://localhost:8080/health

# Remove old version
kubectl delete deployment gateway-green
```

### Method 3: Canary Deployment (Kubernetes)

```bash
# Deploy canary with 10% traffic
kubectl apply -f kubernetes/canary-deployment.yaml

# Monitor error rates and latency
# Wait 10-15 minutes

# If healthy, scale up canary
kubectl scale deployment/gateway-canary --replicas=3

# Shift more traffic
kubectl patch virtualservice gateway --type merge -p '{"spec":{"http":[{"route":[{"destination":{"host":"gateway","subset":"stable"},"weight":50},{"destination":{"host":"gateway","subset":"canary"},"weight":50}]}]}}'

# Complete rollout
kubectl scale deployment/gateway-stable --replicas=0
kubectl scale deployment/gateway-canary --replicas=5
```

## Database Migrations

### Before Migration

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres udagram > backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
head -100 backup-*.sql

# Test migration on staging first
```

### Running Migrations

```bash
# Apply migrations
docker-compose exec postgres psql -U postgres -d udagram -f /migrations/latest.sql

# Verify migration
docker-compose exec postgres psql -U postgres -d udagram -c "\dt"
```

### Rollback Migration

```bash
# Restore from backup
docker-compose exec postgres psql -U postgres -d udagram < backup-YYYYMMDD-HHMMSS.sql
```

## Health Verification

### Automated Health Check Script

```bash
#!/bin/bash
# health-check.sh

SERVICES=("gateway:8080" "auth:8081" "feed:8082" "notification:8083")
FAILED=0

for service in "${SERVICES[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"

    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/health")

    if [ "$response" == "200" ]; then
        echo "✅ $name is healthy"
    else
        echo "❌ $name is unhealthy (status: $response)"
        FAILED=1
    fi
done

# Check metrics endpoint
if curl -s "http://localhost:8080/metrics" | grep -q "http_requests_total"; then
    echo "✅ Metrics endpoint working"
else
    echo "❌ Metrics endpoint failed"
    FAILED=1
fi

# Check database connectivity
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ Database is ready"
else
    echo "❌ Database is not ready"
    FAILED=1
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
    FAILED=1
fi

exit $FAILED
```

### Manual Verification

```bash
# 1. Check all containers are running
docker-compose ps

# 2. Check service logs for errors
docker-compose logs --tail=50 | grep -i error

# 3. Test API endpoints
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/feed

# 4. Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# 5. Check Grafana dashboards load
curl -u admin:admin http://localhost:3000/api/health
```

## Monitoring During Deployment

### Key Metrics to Watch

```bash
# Watch request rate
watch -n 5 'curl -s "http://localhost:9090/api/v1/query?query=sum(rate(http_requests_total[1m]))" | jq .data.result[0].value[1]'

# Watch error rate
watch -n 5 'curl -s "http://localhost:9090/api/v1/query?query=sum(rate(http_requests_total{status=~\"5..\"}[1m]))/sum(rate(http_requests_total[1m]))" | jq .data.result[0].value[1]'

# Watch latency p95
watch -n 5 'curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket[1m]))by(le))" | jq .data.result[0].value[1]'
```

## Rollback Procedures

### Quick Rollback (Docker Compose)

```bash
# Revert to previous image
docker-compose down
git checkout HEAD~1
docker-compose up -d
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/gateway

# Rollback to previous version
kubectl rollout undo deployment/gateway

# Rollback to specific revision
kubectl rollout undo deployment/gateway --to-revision=2

# Monitor rollback
kubectl rollout status deployment/gateway
```

## Post-Deployment

### Verification Steps

1. [ ] All health checks passing
2. [ ] Error rate normal
3. [ ] Latency within SLO
4. [ ] No customer complaints
5. [ ] Alerts cleared

### Documentation

1. Update CHANGELOG.md
2. Close deployment ticket
3. Send deployment notification
4. Update runbooks if needed

### Smoke Tests

```bash
# Run quick smoke tests
npm run test:smoke

# Or manually test key flows
# 1. Registration
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com","password":"Test123!"}'

# 2. Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com","password":"Test123!"}'

# 3. Feed listing
curl http://localhost:8080/api/v1/feed
```

## Emergency Procedures

### Complete Service Failure

```bash
# Stop all services
docker-compose down

# Check for system issues
df -h
free -m
top -bn1 | head -20

# Restart with clean state
docker-compose up -d

# If still failing, check logs
docker-compose logs --tail=200
```

### Deployment Freeze

If production is unstable:

1. Stop all deployments immediately
2. Notify team via #incidents channel
3. Roll back to last known good version
4. Investigate root cause
5. Resume deployments only after approval
