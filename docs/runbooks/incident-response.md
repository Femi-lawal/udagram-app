# Incident Response Runbook

## Severity Levels

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| P1 | Complete outage | 5 minutes | All services down |
| P2 | Major degradation | 15 minutes | Auth service down |
| P3 | Minor degradation | 1 hour | High latency |
| P4 | Low impact | 4 hours | Non-critical errors |

## Initial Response (OODA Loop)

### 1. Observe - What's happening?

```bash
# Check all service health
curl http://localhost:8080/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health

# Check container status
docker-compose ps

# Check recent logs
docker-compose logs --tail=100 --timestamps
```

### 2. Orient - Understand the scope

```bash
# Check metrics for anomalies
curl http://localhost:8080/metrics | grep -E "http_requests_total|http_request_duration"

# Check error rates
curl -s http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])

# Check Prometheus alerts
curl http://localhost:9093/api/v1/alerts
```

### 3. Decide - Plan response

Based on symptoms:
- **All services down** → Check infrastructure (Docker, network)
- **Single service down** → Check specific service logs
- **High latency** → Check database connections, resource usage
- **Error spike** → Check application logs for stack traces

### 4. Act - Execute response

```bash
# Restart a specific service
docker-compose restart <service-name>

# Scale up service (Kubernetes)
kubectl scale deployment/<service> --replicas=3

# View detailed logs
docker-compose logs -f <service-name>
```

## Common Scenarios

### Scenario 1: Service Not Responding

**Symptoms**: Health check fails, 502/503 errors

**Diagnosis**:
```bash
# Check if container is running
docker-compose ps <service>

# Check container logs
docker-compose logs --tail=50 <service>

# Check resource usage
docker stats
```

**Resolution**:
```bash
# Restart the service
docker-compose restart <service>

# If container keeps crashing, check for OOM
docker inspect <container_id> | grep OOMKilled

# Increase memory limits if needed
# Edit docker-compose.yml and redeploy
```

### Scenario 2: Database Connection Issues

**Symptoms**: "connection refused", "too many connections"

**Diagnosis**:
```bash
# Check PostgreSQL
docker-compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection limits
docker-compose exec postgres psql -U postgres -c "SHOW max_connections;"
```

**Resolution**:
```bash
# Kill idle connections
docker-compose exec postgres psql -U postgres -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle' 
  AND query_start < NOW() - INTERVAL '5 minutes';
"

# Restart database (last resort)
docker-compose restart postgres
```

### Scenario 3: High Memory Usage

**Symptoms**: OOM kills, slow response times

**Diagnosis**:
```bash
# Check memory usage
docker stats --no-stream

# Check Go heap stats
curl http://localhost:8080/debug/pprof/heap?debug=1
```

**Resolution**:
```bash
# Trigger garbage collection (if exposed)
# For Go services, GC runs automatically

# Restart service to reclaim memory
docker-compose restart <service>

# Scale horizontally
kubectl scale deployment/<service> --replicas=3
```

### Scenario 4: Redis Connection Issues

**Symptoms**: Cache misses, slow response times

**Diagnosis**:
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check Redis info
docker-compose exec redis redis-cli info

# Check connected clients
docker-compose exec redis redis-cli client list
```

**Resolution**:
```bash
# Clear Redis cache if needed
docker-compose exec redis redis-cli FLUSHDB

# Restart Redis
docker-compose restart redis
```

### Scenario 5: Kafka Issues

**Symptoms**: Notification delays, message backlog

**Diagnosis**:
```bash
# Check Kafka broker status
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Check consumer lag
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --all-groups
```

**Resolution**:
```bash
# Restart Kafka consumer
docker-compose restart notification

# If topic is corrupt, recreate
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic notifications
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic notifications --partitions 3 --replication-factor 1
```

## Post-Incident

### Immediate Actions (within 1 hour)

1. Document timeline of events
2. Identify root cause
3. Implement temporary fixes
4. Verify service restoration

### Follow-up Actions (within 24 hours)

1. Write incident report
2. Schedule post-mortem
3. Create action items for permanent fixes
4. Update runbooks if needed

### Incident Report Template

```markdown
## Incident Report - [DATE]

### Summary
Brief description of the incident

### Timeline
- HH:MM - Alert triggered
- HH:MM - On-call acknowledged
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

### Root Cause
Detailed explanation of what caused the incident

### Impact
- Duration: X minutes
- Users affected: Y
- Revenue impact: $Z

### Resolution
What was done to fix the issue

### Action Items
1. [ ] Permanent fix for root cause
2. [ ] Improve monitoring
3. [ ] Update runbook

### Lessons Learned
What we learned from this incident
```

## Emergency Contacts

| Role | Contact | Phone |
|------|---------|-------|
| On-call SRE | pager@company.com | +1-XXX-XXX-XXXX |
| Platform Lead | platform@company.com | +1-XXX-XXX-XXXX |
| Database Admin | dba@company.com | +1-XXX-XXX-XXXX |
