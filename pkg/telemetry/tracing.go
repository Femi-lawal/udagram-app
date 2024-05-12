package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Config holds telemetry configuration
type Config struct {
	ServiceName  string
	Environment  string
	OTLPEndpoint string
	SampleRate   float64
	Enabled      bool
}

// Provider wraps the tracer provider
type Provider struct {
	tracerProvider *sdktrace.TracerProvider
	tracer         trace.Tracer
}

// NewProvider creates a new telemetry provider
func NewProvider(ctx context.Context, cfg Config) (*Provider, error) {
	if !cfg.Enabled {
		return &Provider{
			tracer: otel.Tracer(cfg.ServiceName),
		}, nil
	}

	// Create OTLP exporter
	conn, err := grpc.DialContext(ctx, cfg.OTLPEndpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, err
	}

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, err
	}

	// Create resource
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(cfg.ServiceName),
			semconv.DeploymentEnvironment(cfg.Environment),
			attribute.String("service.version", "1.0.0"),
		),
	)
	if err != nil {
		return nil, err
	}

	// Create sampler
	var sampler sdktrace.Sampler
	if cfg.SampleRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else if cfg.SampleRate <= 0 {
		sampler = sdktrace.NeverSample()
	} else {
		sampler = sdktrace.TraceIDRatioBased(cfg.SampleRate)
	}

	// Create tracer provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	// Set global tracer provider
	otel.SetTracerProvider(tp)

	// Set propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return &Provider{
		tracerProvider: tp,
		tracer:         tp.Tracer(cfg.ServiceName),
	}, nil
}

// Tracer returns the tracer
func (p *Provider) Tracer() trace.Tracer {
	return p.tracer
}

// Shutdown shuts down the tracer provider
func (p *Provider) Shutdown(ctx context.Context) error {
	if p.tracerProvider != nil {
		return p.tracerProvider.Shutdown(ctx)
	}
	return nil
}

// StartSpan starts a new span
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return otel.Tracer("").Start(ctx, name, opts...)
}

// SpanFromContext returns the span from context
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// AddEvent adds an event to the current span
func AddEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.AddEvent(name, trace.WithAttributes(attrs...))
}

// SetError records an error on the current span
func SetError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	span.RecordError(err)
}

// SetAttributes sets attributes on the current span
func SetAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attrs...)
}

// TraceID returns the trace ID from context
func TraceID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().HasTraceID() {
		return span.SpanContext().TraceID().String()
	}
	return ""
}

// SpanID returns the span ID from context
func SpanID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().HasSpanID() {
		return span.SpanContext().SpanID().String()
	}
	return ""
}

// DatabaseSpan starts a database operation span
func DatabaseSpan(ctx context.Context, operation, table string) (context.Context, trace.Span) {
	return StartSpan(ctx, "db."+operation,
		trace.WithAttributes(
			semconv.DBSystemPostgreSQL,
			semconv.DBOperation(operation),
			semconv.DBSQLTable(table),
		),
	)
}

// CacheSpan starts a cache operation span
func CacheSpan(ctx context.Context, operation string) (context.Context, trace.Span) {
	return StartSpan(ctx, "cache."+operation,
		trace.WithAttributes(
			attribute.String("cache.system", "redis"),
			attribute.String("cache.operation", operation),
		),
	)
}

// HTTPClientSpan starts an HTTP client span
func HTTPClientSpan(ctx context.Context, method, url string) (context.Context, trace.Span) {
	return StartSpan(ctx, "http.client",
		trace.WithAttributes(
			semconv.HTTPMethod(method),
			semconv.HTTPURL(url),
		),
	)
}

// KafkaProducerSpan starts a Kafka producer span
func KafkaProducerSpan(ctx context.Context, topic string) (context.Context, trace.Span) {
	return StartSpan(ctx, "kafka.produce",
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.destination", topic),
			attribute.String("messaging.operation", "publish"),
		),
	)
}

// KafkaConsumerSpan starts a Kafka consumer span
func KafkaConsumerSpan(ctx context.Context, topic string) (context.Context, trace.Span) {
	return StartSpan(ctx, "kafka.consume",
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.destination", topic),
			attribute.String("messaging.operation", "receive"),
		),
	)
}

// MeasureDuration measures the duration of an operation and adds it to the span
func MeasureDuration(ctx context.Context, start time.Time, name string) {
	duration := time.Since(start)
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.Int64(name+".duration_ms", duration.Milliseconds()))
}
