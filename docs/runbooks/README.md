# Udagram SRE Runbooks

This directory contains runbooks for common operational tasks and incident response procedures.

## Quick Reference

| Situation | Runbook |
|-----------|---------|
| Service Down | [incident-response.md](./incident-response.md) |
| High Latency | [high-latency.md](./high-latency.md) |
| Database Issues | [database-issues.md](./database-issues.md) |
| Memory/CPU Issues | [resource-exhaustion.md](./resource-exhaustion.md) |
| Deployment | [deployment.md](./deployment.md) |
| Rollback | [rollback.md](./rollback.md) |
| Scaling | [scaling.md](./scaling.md) |

## Service Architecture

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Gateway     │
                    │   (Port 8080)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│  Auth Service │   │  Feed Service │   │  Notification │
│  (Port 8081)  │   │  (Port 8082)  │   │  (Port 8083)  │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│   PostgreSQL  │   │     Redis     │   │     Kafka     │
│  (Port 5432)  │   │  (Port 6379)  │   │  (Port 9092)  │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Monitoring Endpoints

| Service | Health | Metrics | Ready |
|---------|--------|---------|-------|
| Gateway | :8080/health | :8080/metrics | :8080/ready |
| Auth | :8081/health | :8081/metrics | :8081/ready |
| Feed | :8082/health | :8082/metrics | :8082/ready |
| Notification | :8083/health | :8083/metrics | :8083/ready |

## Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
  - [Overview Dashboard](http://localhost:3000/d/overview)
  - [SLO Dashboard](http://localhost:3000/d/slo)
  - [Infrastructure Dashboard](http://localhost:3000/d/infra)

- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Alertmanager**: http://localhost:9093

## Contact / Escalation

| Level | Contact | When |
|-------|---------|------|
| L1 | On-call SRE | All alerts |
| L2 | Platform Team Lead | Service-wide outages |
| L3 | Engineering Manager | Extended outages (>30m) |
