package messaging

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// Metrics
var (
	kafkaMessagesProduced = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_messages_produced_total",
			Help: "Total number of Kafka messages produced",
		},
		[]string{"topic"},
	)

	kafkaMessagesConsumed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_messages_consumed_total",
			Help: "Total number of Kafka messages consumed",
		},
		[]string{"topic"},
	)

	kafkaProduceLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "kafka_produce_duration_seconds",
			Help:    "Kafka message produce duration in seconds",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"topic"},
	)

	kafkaConsumeLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "kafka_consume_duration_seconds",
			Help:    "Kafka message consume processing duration in seconds",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		},
		[]string{"topic"},
	)

	kafkaErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_errors_total",
			Help: "Total number of Kafka errors",
		},
		[]string{"topic", "operation"},
	)
)

// Topics
const (
	TopicUserCreated    = "user.created"
	TopicUserUpdated    = "user.updated"
	TopicFeedCreated    = "feed.created"
	TopicFeedDeleted    = "feed.deleted"
	TopicNotification   = "notification"
	TopicAnalyticsEvent = "analytics.event"
)

// Event represents a domain event
type Event struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Source    string                 `json:"source"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
	Metadata  map[string]string      `json:"metadata,omitempty"`
}

// NewEvent creates a new event
func NewEvent(eventType, source string, data map[string]interface{}) Event {
	return Event{
		ID:        uuid.New().String(),
		Type:      eventType,
		Source:    source,
		Timestamp: time.Now().UTC(),
		Data:      data,
		Metadata:  make(map[string]string),
	}
}

// Config holds Kafka configuration
type Config struct {
	Brokers       []string
	ConsumerGroup string
	Topics        map[string]string
}

// Producer wraps Kafka writer for producing messages
type Producer struct {
	writers map[string]*kafka.Writer
	logger  *zap.Logger
}

// NewProducer creates a new Kafka producer
func NewProducer(cfg Config, logger *zap.Logger) *Producer {
	writers := make(map[string]*kafka.Writer)

	// Create writers for each topic
	topics := []string{
		TopicUserCreated,
		TopicUserUpdated,
		TopicFeedCreated,
		TopicFeedDeleted,
		TopicNotification,
		TopicAnalyticsEvent,
	}

	for _, topic := range topics {
		writers[topic] = &kafka.Writer{
			Addr:         kafka.TCP(cfg.Brokers...),
			Topic:        topic,
			Balancer:     &kafka.LeastBytes{},
			BatchTimeout: 10 * time.Millisecond,
			Async:        false,
		}
	}

	return &Producer{
		writers: writers,
		logger:  logger,
	}
}

// Publish publishes a message to a topic
func (p *Producer) Publish(ctx context.Context, topic string, key string, event Event) error {
	start := time.Now()
	defer func() {
		kafkaProduceLatency.WithLabelValues(topic).Observe(time.Since(start).Seconds())
	}()

	writer, exists := p.writers[topic]
	if !exists {
		kafkaErrors.WithLabelValues(topic, "produce").Inc()
		return ErrTopicNotFound
	}

	data, err := json.Marshal(event)
	if err != nil {
		kafkaErrors.WithLabelValues(topic, "produce").Inc()
		return err
	}

	msg := kafka.Message{
		Key:   []byte(key),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_id", Value: []byte(event.ID)},
			{Key: "event_type", Value: []byte(event.Type)},
			{Key: "source", Value: []byte(event.Source)},
		},
	}

	if err := writer.WriteMessages(ctx, msg); err != nil {
		kafkaErrors.WithLabelValues(topic, "produce").Inc()
		p.logger.Error("failed to publish message",
			zap.String("topic", topic),
			zap.Error(err),
		)
		return err
	}

	kafkaMessagesProduced.WithLabelValues(topic).Inc()
	p.logger.Debug("message published",
		zap.String("topic", topic),
		zap.String("event_id", event.ID),
		zap.String("event_type", event.Type),
	)

	return nil
}

// PublishAsync publishes a message asynchronously
func (p *Producer) PublishAsync(ctx context.Context, topic string, key string, event Event) {
	go func() {
		if err := p.Publish(ctx, topic, key, event); err != nil {
			p.logger.Error("async publish failed",
				zap.String("topic", topic),
				zap.Error(err),
			)
		}
	}()
}

// Close closes all writers
func (p *Producer) Close() error {
	var lastErr error
	for _, writer := range p.writers {
		if err := writer.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// Consumer wraps Kafka reader for consuming messages
type Consumer struct {
	reader  *kafka.Reader
	logger  *zap.Logger
	handler MessageHandler
}

// MessageHandler handles incoming messages
type MessageHandler func(ctx context.Context, event Event) error

// NewConsumer creates a new Kafka consumer
func NewConsumer(cfg Config, topic, groupID string, logger *zap.Logger, handler MessageHandler) *Consumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        cfg.Brokers,
		GroupID:        groupID,
		Topic:          topic,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		MaxWait:        1 * time.Second,
		StartOffset:    kafka.LastOffset,
		CommitInterval: time.Second,
	})

	return &Consumer{
		reader:  reader,
		logger:  logger,
		handler: handler,
	}
}

// Start starts consuming messages
func (c *Consumer) Start(ctx context.Context) error {
	c.logger.Info("starting consumer", zap.String("topic", c.reader.Config().Topic))

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("stopping consumer")
			return ctx.Err()
		default:
			msg, err := c.reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				c.logger.Error("failed to fetch message", zap.Error(err))
				kafkaErrors.WithLabelValues(c.reader.Config().Topic, "consume").Inc()
				continue
			}

			start := time.Now()
			var event Event
			if err := json.Unmarshal(msg.Value, &event); err != nil {
				c.logger.Error("failed to unmarshal message", zap.Error(err))
				kafkaErrors.WithLabelValues(c.reader.Config().Topic, "unmarshal").Inc()
				continue
			}

			if err := c.handler(ctx, event); err != nil {
				c.logger.Error("failed to handle message",
					zap.String("event_id", event.ID),
					zap.Error(err),
				)
				kafkaErrors.WithLabelValues(c.reader.Config().Topic, "handle").Inc()
				continue
			}

			if err := c.reader.CommitMessages(ctx, msg); err != nil {
				c.logger.Error("failed to commit message", zap.Error(err))
				kafkaErrors.WithLabelValues(c.reader.Config().Topic, "commit").Inc()
				continue
			}

			kafkaMessagesConsumed.WithLabelValues(c.reader.Config().Topic).Inc()
			kafkaConsumeLatency.WithLabelValues(c.reader.Config().Topic).Observe(time.Since(start).Seconds())
		}
	}
}

// Close closes the consumer
func (c *Consumer) Close() error {
	return c.reader.Close()
}

// Errors
var (
	ErrTopicNotFound = &MessageError{Message: "topic not found"}
)

// MessageError represents a messaging error
type MessageError struct {
	Message string
}

func (e *MessageError) Error() string {
	return e.Message
}
