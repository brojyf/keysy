package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
)

const instrumentationName = "github.com/brojyf/keysy/api/internal/middleware"

// Telemetry records one server span and one duration measurement per request.
// Like Log, it records only the method, route template, status, and request ID:
// never raw paths, queries, headers, client addresses, or user agents.
// It runs first so the span covers recovery and sees the final status.
func Telemetry(tracerProvider trace.TracerProvider, meterProvider metric.MeterProvider) gin.HandlerFunc {
	tracer := tracerProvider.Tracer(instrumentationName)
	duration, err := meterProvider.Meter(instrumentationName).Float64Histogram("http.server.request.duration",
		metric.WithUnit("s"), metric.WithDescription("Duration of HTTP server requests."),
		metric.WithExplicitBucketBoundaries(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10))
	if err != nil {
		panic(err)
	}
	return func(c *gin.Context) {
		start := time.Now()
		method := requestMethod(c.Request.Method)
		ctx, span := tracer.Start(c.Request.Context(), method, trace.WithSpanKind(trace.SpanKindServer))
		defer span.End()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
		attrs := []attribute.KeyValue{semconv.HTTPRequestMethodKey.String(method), semconv.HTTPResponseStatusCode(c.Writer.Status())}
		if route := c.FullPath(); route != "" {
			attrs = append(attrs, semconv.HTTPRoute(route))
			span.SetName(method + " " + route)
		}
		if c.Writer.Status() >= http.StatusInternalServerError {
			span.SetStatus(codes.Error, "")
		}
		duration.Record(ctx, time.Since(start).Seconds(), metric.WithAttributes(attrs...))
		span.SetAttributes(append(attrs, attribute.String("request_id", c.GetString("request_id")))...)
	}
}

// requestMethod maps unknown methods to "_OTHER" so arbitrary input cannot create new series.
func requestMethod(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodConnect, http.MethodOptions, http.MethodTrace:
		return method
	}
	return "_OTHER"
}
