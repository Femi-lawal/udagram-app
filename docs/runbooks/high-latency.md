# High Latency Runbook

## Overview

This runbook addresses situations where API response times exceed SLO thresholds.

### SLO Thresholds

| Percentile | Threshold | Alert |
|------------|-----------|-------|
| p50 | 100ms | Warning |
| p95 | 300ms | Warning |
| p99 | 1000ms | Critical |

## Quick Diagnosis

### Step 1: Identify Affected Service

```bash
# Check latency metrics for each service
curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))" | jq .

# Or use this one-liner for all services
for service in gateway auth feed notification; do
  echo "=== $service ==="
  curl -s "http://localhost:909/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket{service=\"$service\"}[5m]))" | jq '.data.result[0].value[1]'
done
```

### Step 2: Check Common Causes

#### Database Latency

```bash
# Check PostgreSQL slow queries
docker-compose exec postgres psql -U postgres -c "
  SELECT pid, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY duration DESC
  LIMIT 5;
"

# Check active connections
docker-compose exec postgres psql -U postgres -c "
  SELECT count(*), state 
  FROM pg_stat_activity 
  GROUP BY state;
"
```

#### Redis Latency

```bash
# Check Redis slowlog
docker-compose exec redis redis-cli SLOWLOG GET 10

# Check Redis latency
docker-compose exec redis redis-cli --latency

# Check memory usage
docker-compose exec redis redis-cli INFO memory | grep used_memory_human
```

#### Resource Saturation

```bash
# Check container CPU and memory
docker stats --no-stream

# Check system load
uptime

# Check disk I/O
iostat -x 1 5
```

#### Network Issues

```bash
# Check network latency between services
docker-compose exec gateway ping -c 5 auth

# Check DNS resolution
docker-compose exec gateway nslookup auth

# Check connection counts
ss -s
```

## Remediation Actions

### 1. Immediate - Reduce Load

```bash
# Enable rate limiting (if not already enabled)
# Update Nginx/Gateway config to reduce max connections

# Scale horizontally (Kubernetes)
kubectl scale deployment/feed --replicas=5

# Restart overloaded service
docker-compose restart <service>
```

### 2. Database Optimization

```bash
# Kill long-running queries
docker-compose exec postgres psql -U postgres -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE duration > interval '30 seconds'
  AND state = 'active';
"

# Analyze tables (update statistics)
docker-compose exec postgres psql -U postgres -c "ANALYZE;"

# Check for missing indexes
docker-compose exec postgres psql -U postgres -c "
  SELECT schemaname, tablename, attname, null_frac, n_distinct
  FROM pg_stats
  WHERE schemaname = 'public'
  ORDER BY null_frac DESC
  LIMIT 10;
"
```

### 3. Redis Optimization

```bash
# Clear large keys
docker-compose exec redis redis-cli --bigkeys

# Enable memory limits
docker-compose exec redis redis-cli CONFIG SET maxmemory 512mb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 4. Connection Pool Tuning

If seeing connection exhaustion, update service configuration:

```yaml
# config/config.yaml
database:
  max_open_conns: 25
  max_idle_conns: 25
  conn_max_lifetime: 5m

redis:
  pool_size: 10
  min_idle_conns: 5
```

### 5. Enable Query Caching

```bash
# Verify Redis caching is working
docker-compose exec redis redis-cli KEYS "*"

# Check hit/miss ratio
docker-compose exec redis redis-cli INFO stats | grep keyspace
```

## Tracing Analysis

### Using Jaeger

1. Open Jaeger UI: http://localhost:16686
2. Select the affected service
3. Look for traces with high duration
4. Identify the slow span

### Common Patterns

| Pattern | Cause | Solution |
|---------|-------|----------|
| DB spans slow | Query performance | Add indexes, optimize queries |
| Redis spans slow | Network/memory | Check Redis memory, network |
| Service spans slow | CPU bound | Scale horizontally |
| External API slow | Third-party issue | Add circuit breaker |

## Metrics to Monitor

### Key Queries for Prometheus

```promql
# Request rate by status
sum(rate(http_requests_total[5m])) by (service, status)

# P95 latency by endpoint
histogram_quantile(0.95, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path)
)

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) 
/ 
sum(rate(http_requests_total[5m]))

# Active connections
sum(http_connections_current) by (service)
```

## Grafana Dashboard Panels

Navigate to the SLO Dashboard and check:

1. **Latency Distribution**: Shows p50, p95, p99 over time
2. **Slow Requests**: Lists endpoints exceeding threshold
3. **Database Performance**: DB query duration histogram
4. **Cache Performance**: Redis hit/miss rates

## Escalation Criteria

Escalate to L2 if:
- Latency remains high for > 15 minutes after remediation
- Root cause is not identifiable
- Infrastructure changes are required

Escalate to L3 if:
- Multiple services affected
- Database or infrastructure failure
- Requires code changes for fix

## Post-Incident

1. Document the cause and resolution
2. Create alerts for early detection
3. Consider adding:
   - Circuit breakers
   - Request timeouts
   - Better caching
   - Query optimization
