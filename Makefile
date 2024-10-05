.PHONY: all build test lint clean docker-build docker-push run migrate help

# Variables
GO := go
DOCKER := docker
DOCKER_COMPOSE := docker-compose
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS := -w -s -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)
REGISTRY := docker.io
USERNAME := femilawal

# Services
SERVICES := gateway auth feed notification

# Default target
all: lint test build

## help: Display this help message
help:
	@echo "Udagram - Cloud Native Image Sharing Platform"
	@echo ""
	@echo "Usage:"
	@echo "  make <target>"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'

## build: Build all services
build:
	@echo "Building all services..."
	@mkdir -p bin
	@for service in $(SERVICES); do \
		echo "Building $$service..."; \
		CGO_ENABLED=0 GOOS=linux $(GO) build -ldflags="$(LDFLAGS)" -o bin/$$service ./services/$$service; \
	done
	@echo "Build complete!"

## build-service: Build a specific service (usage: make build-service SERVICE=gateway)
build-service:
	@echo "Building $(SERVICE)..."
	CGO_ENABLED=0 GOOS=linux $(GO) build -ldflags="$(LDFLAGS)" -o bin/$(SERVICE) ./services/$(SERVICE)

## test: Run all tests
test:
	@echo "Running tests..."
	$(GO) test -v -race -coverprofile=coverage.out ./...

## test-coverage: Run tests with coverage report
test-coverage: test
	$(GO) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report saved to coverage.html"

## lint: Run linters
lint:
	@echo "Running linters..."
	golangci-lint run ./...

## fmt: Format code
fmt:
	$(GO) fmt ./...

## vet: Run go vet
vet:
	$(GO) vet ./...

## clean: Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf bin/
	rm -f coverage.out coverage.html

## deps: Download dependencies
deps:
	$(GO) mod download
	$(GO) mod tidy

## docker-build: Build all Docker images
docker-build:
	@echo "Building Docker images..."
	@for service in $(SERVICES); do \
		echo "Building $$service image..."; \
		$(DOCKER) build -t $(REGISTRY)/$(USERNAME)/udagram-$$service:$(VERSION) \
			-t $(REGISTRY)/$(USERNAME)/udagram-$$service:latest \
			-f services/$$service/Dockerfile .; \
	done

## docker-push: Push all Docker images
docker-push:
	@echo "Pushing Docker images..."
	@for service in $(SERVICES); do \
		$(DOCKER) push $(REGISTRY)/$(USERNAME)/udagram-$$service:$(VERSION); \
		$(DOCKER) push $(REGISTRY)/$(USERNAME)/udagram-$$service:latest; \
	done

## run: Start all services with docker-compose
run:
	$(DOCKER_COMPOSE) up -d

## run-build: Build and start all services with docker-compose
run-build:
	$(DOCKER_COMPOSE) up -d --build

## stop: Stop all services
stop:
	$(DOCKER_COMPOSE) down

## logs: View logs from all services
logs:
	$(DOCKER_COMPOSE) logs -f

## logs-service: View logs from a specific service (usage: make logs-service SERVICE=gateway)
logs-service:
	$(DOCKER_COMPOSE) logs -f $(SERVICE)

## migrate: Run database migrations
migrate:
	@echo "Running migrations..."
	@./scripts/migrate.sh

## health: Run health checks
health:
	@./scripts/health-check.sh

## api-test: Run API tests
api-test:
	@./scripts/api-test.sh

## k8s-deploy: Deploy to Kubernetes
k8s-deploy:
	@./scripts/deploy.sh

## k8s-status: Show Kubernetes deployment status
k8s-status:
	kubectl get pods -n udagram
	kubectl get services -n udagram
	kubectl get ingress -n udagram

## install-tools: Install development tools
install-tools:
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	$(GO) install golang.org/x/vuln/cmd/govulncheck@latest

## security-scan: Run security scans
security-scan:
	govulncheck ./...

## generate: Generate code (mocks, etc.)
generate:
	$(GO) generate ./...
