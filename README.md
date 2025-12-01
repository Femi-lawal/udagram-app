# Udagram - Cloud-Native Image Sharing Platform

[![Build Status](https://github.com/Femi-lawal/udagram-app/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/Femi-lawal/udagram-app/actions)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://docker.com)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=flat&logo=kubernetes)](https://kubernetes.io)

A production-ready, cloud-native image sharing microservices platform demonstrating advanced software engineering and SRE practices. Built with Go, featuring comprehensive observability, security, and scalability patterns.

## 🏗️ Architecture

```
                                    ┌─────────────────┐
                                    │   Load Balancer │
                                    │    (Ingress)    │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   API Gateway   │
                                    │  (Rate Limit,   │
                                    │   Auth, Trace)  │
                                    └────────┬────────┘
                           ┌─────────────────┼─────────────────┐
                           │                 │                 │
                  ┌────────▼────────┐ ┌──────▼──────┐ ┌───────▼───────┐
                  │   Auth Service  │ │Feed Service │ │  Notification │
                  │   (Go + JWT)    │ │  (Go + S3)  │ │   Service     │
                  └────────┬────────┘ └──────┬──────┘ └───────┬───────┘
                           │                 │                 │
              ┌────────────┴─────────────────┴─────────────────┘
              │
    ┌─────────▼─────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   PostgreSQL      │  │     Redis       │  │     Kafka       │
    │   (Primary DB)    │  │   (Cache/       │  │ (Event Stream)  │
    │                   │  │    Sessions)    │  │                 │
    └───────────────────┘  └─────────────────┘  └─────────────────┘

                    Observability Stack
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   Prometheus    │  │    Grafana      │  │     Jaeger      │
    │   (Metrics)     │  │  (Dashboards)   │  │   (Tracing)     │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 🚀 Features

### Microservices

- **API Gateway**: Rate limiting, circuit breaker, request validation, JWT verification
- **Auth Service**: User registration, authentication, JWT token management, session handling
- **Feed Service**: Image upload, feed management, S3 integration, caching
- **Notification Service**: Event-driven notifications via Kafka

### Infrastructure

- **Container Orchestration**: Kubernetes with HPA, PDB, and resource management
- **Service Mesh Ready**: Prepared for Istio/Linkerd integration
- **Infrastructure as Code**: Complete K8s manifests and Helm charts

### Observability (SRE)

- **Distributed Tracing**: OpenTelemetry + Jaeger integration
- **Metrics**: Prometheus with custom application metrics
- **Dashboards**: Pre-configured Grafana dashboards
- **Alerting**: AlertManager with PagerDuty/Slack integration
- **Logging**: Structured JSON logging with correlation IDs

### Security

- **Authentication**: JWT with refresh tokens
- **Authorization**: RBAC implementation
- **Encryption**: TLS everywhere, encrypted secrets
- **Security Headers**: OWASP recommended headers
- **Rate Limiting**: Per-user and per-IP rate limiting
- **Input Validation**: Comprehensive request validation

### Data Layer

- **PostgreSQL**: Primary data store with migrations
- **Redis**: Session storage and caching layer
- **Kafka**: Event streaming for async operations
- **S3**: Object storage for images

## 📁 Project Structure

```
udagram-app/
├── services/                    # Microservices
│   ├── gateway/                 # API Gateway (Go)
│   ├── auth/                    # Authentication Service (Go)
│   ├── feed/                    # Feed Service (Go)
│   └── notification/            # Notification Service (Go)
├── pkg/                         # Shared packages
│   ├── common/                  # Common utilities
│   ├── middleware/              # HTTP middlewares
│   ├── telemetry/               # OpenTelemetry setup
│   ├── database/                # Database utilities
│   ├── cache/                   # Redis client
│   └── messaging/               # Kafka client
├── infrastructure/              # Infrastructure configs
│   ├── kubernetes/              # K8s manifests
│   ├── docker/                  # Docker configs
│   └── monitoring/              # Prometheus, Grafana, AlertManager
├── migrations/                  # Database migrations
├── scripts/                     # Utility scripts
├── docs/                        # Documentation
├── .github/workflows/           # CI/CD pipelines
└── udagram-frontend/            # Angular frontend (legacy)
```

## 🛠️ Technology Stack

| Category              | Technology             |
| --------------------- | ---------------------- |
| **Language**          | Go 1.21+, TypeScript   |
| **Framework**         | Gin (HTTP), GORM (ORM) |
| **Database**          | PostgreSQL 15          |
| **Cache**             | Redis 7                |
| **Message Queue**     | Apache Kafka           |
| **Container Runtime** | Docker, containerd     |
| **Orchestration**     | Kubernetes 1.28+       |
| **Tracing**           | OpenTelemetry, Jaeger  |
| **Metrics**           | Prometheus             |
| **Dashboards**        | Grafana                |
| **CI/CD**             | GitHub Actions         |
| **Cloud**             | AWS (S3, RDS, EKS)     |

## 🏃 Quick Start

### Prerequisites

- Go 1.21+
- Docker & Docker Compose
- kubectl (for Kubernetes deployment)
- Make

### Local Development

```bash
# Clone the repository
git clone https://github.com/Femi-lawal/udagram-app.git
cd udagram-app

# Start infrastructure (PostgreSQL, Redis, Kafka)
make infra-up

# Run all services locally
make run-all

# Or run individual services
make run-gateway
make run-auth
make run-feed
```

### Docker Compose

```bash
# Build and start all services
docker-compose up --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace udagram

# Apply configurations
kubectl apply -f infrastructure/kubernetes/ -n udagram

# Check deployment status
kubectl get pods -n udagram

# Port forward for local access
kubectl port-forward svc/gateway 8080:8080 -n udagram
```

## 📊 API Documentation

### Authentication

```bash
# Register a new user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'

# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'

# Refresh token
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Authorization: Bearer <refresh_token>"
```

### Feed

```bash
# Get all feed items
curl http://localhost:8080/api/v1/feed \
  -H "Authorization: Bearer <access_token>"

# Create feed item
curl -X POST http://localhost:8080/api/v1/feed \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"caption": "My photo", "url": "image.jpg"}'

# Get signed URL for upload
curl http://localhost:8080/api/v1/feed/signed-url/myimage.jpg \
  -H "Authorization: Bearer <access_token>"
```

### Health & Metrics

```bash
# Health check
curl http://localhost:8080/health

# Readiness check
curl http://localhost:8080/ready

# Prometheus metrics
curl http://localhost:8080/metrics
```

## 🔍 Observability

### Accessing Dashboards

| Service      | URL                    | Credentials |
| ------------ | ---------------------- | ----------- |
| Grafana      | http://localhost:3000  | admin/admin |
| Prometheus   | http://localhost:9090  | -           |
| Jaeger       | http://localhost:16686 | -           |
| AlertManager | http://localhost:9093  | -           |

### Key Metrics

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency histogram
- `db_query_duration_seconds` - Database query latency
- `cache_hits_total` / `cache_misses_total` - Cache effectiveness
- `kafka_messages_published_total` - Kafka message throughput

## 🧪 Testing

```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Run integration tests
make test-integration

# Run e2e tests
make test-e2e

# Run load tests
make test-load
```

## 🔒 Security

### Environment Variables

Create a `.env` file (never commit to git):

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=udagram
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=udagram

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# Kafka
KAFKA_BROKERS=localhost:9092

# JWT
JWT_SECRET=<32-byte-secret>
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AWS
AWS_REGION=us-east-1
AWS_BUCKET=udagram-media
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>

# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
```

### Security Features

- All passwords hashed with bcrypt (cost=12)
- JWT tokens with short expiry (15 min)
- Refresh token rotation
- Rate limiting (100 req/min per user)
- CORS with whitelist
- Security headers (CSP, X-Frame-Options, etc.)
- SQL injection prevention via parameterized queries
- Input sanitization and validation

## 🚢 CI/CD Pipeline

The pipeline includes:

1. **Lint & Format**: golangci-lint, gofmt
2. **Unit Tests**: With coverage threshold (80%)
3. **Security Scan**: Trivy, gosec
4. **Build**: Multi-stage Docker builds
5. **Integration Tests**: Against test containers
6. **Push**: To container registry
7. **Deploy**: To Kubernetes (staging/production)

## 📈 Performance

### Benchmarks

| Endpoint         | p50  | p95   | p99   | RPS   |
| ---------------- | ---- | ----- | ----- | ----- |
| GET /health      | 1ms  | 2ms   | 5ms   | 10000 |
| POST /auth/login | 50ms | 100ms | 200ms | 500   |
| GET /feed        | 10ms | 30ms  | 50ms  | 2000  |
| POST /feed       | 20ms | 50ms  | 100ms | 1000  |

### Scaling Guidelines

- Gateway: 2-10 replicas (CPU-based HPA)
- Auth: 2-5 replicas (CPU-based HPA)
- Feed: 3-10 replicas (CPU + memory HPA)
- Notification: 2-5 replicas (Kafka consumer groups)

## 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Originally developed as part of Udacity Cloud Engineering Nanodegree
- Modernized with production-ready patterns and SRE practices
