package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

func telemetryRouter(t *testing.T) (*gin.Engine, *tracetest.SpanRecorder, *sdkmetric.ManualReader) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	spans := tracetest.NewSpanRecorder()
	reader := sdkmetric.NewManualReader()
	r := gin.New()
	r.Use(Telemetry(sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(spans)), sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))), Recovery(slog.New(slog.DiscardHandler)), RequestID())
	r.GET("/callback/:id", func(c *gin.Context) { c.Status(204) })
	r.GET("/panic", func(*gin.Context) { panic("boom") })
	return r, spans, reader
}

func spanAttributes(span sdktrace.ReadOnlySpan) map[attribute.Key]attribute.Value {
	attrs := map[attribute.Key]attribute.Value{}
	for _, kv := range span.Attributes() {
		attrs[kv.Key] = kv.Value
	}
	return attrs
}

func TestTelemetryRecordsOnlyRouteTemplate(t *testing.T) {
	r, spans, reader := telemetryRouter(t)
	req := httptest.NewRequest("GET", "/callback/secret-path?code=secret-code", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	req.Header.Set("User-Agent", "secret-agent")
	req.Header.Set("Traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	ended := spans.Ended()
	if len(ended) != 1 {
		t.Fatalf("spans = %d", len(ended))
	}
	span := ended[0]
	if span.Name() != "GET /callback/:id" || span.SpanKind() != trace.SpanKindServer || span.Parent().IsValid() {
		t.Fatalf("name=%q kind=%v parent=%v", span.Name(), span.SpanKind(), span.Parent())
	}
	attrs := spanAttributes(span)
	want := map[attribute.Key]attribute.Value{
		"http.request.method":       attribute.StringValue("GET"),
		"http.route":                attribute.StringValue("/callback/:id"),
		"http.response.status_code": attribute.IntValue(204),
		"request_id":                attribute.StringValue(w.Header().Get("X-Request-ID")),
	}
	if fmt.Sprint(attrs) != fmt.Sprint(want) {
		t.Fatalf("attributes = %v", attrs)
	}

	var metrics metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &metrics); err != nil {
		t.Fatal(err)
	}
	histogram := metrics.ScopeMetrics[0].Metrics[0]
	points := histogram.Data.(metricdata.Histogram[float64]).DataPoints
	if histogram.Name != "http.server.request.duration" || histogram.Unit != "s" || len(points) != 1 || points[0].Count != 1 {
		t.Fatalf("metric = %+v", histogram)
	}
	if route, _ := points[0].Attributes.Value("http.route"); route.AsString() != "/callback/:id" {
		t.Fatalf("metric attributes = %v", points[0].Attributes)
	}
	if _, ok := points[0].Attributes.Value("request_id"); ok {
		t.Fatal("request_id must not be a metric attribute")
	}
}

func TestTelemetryMarksRecoveredPanicAsError(t *testing.T) {
	r, spans, _ := telemetryRouter(t)
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/panic", nil))
	span := spans.Ended()[0]
	if span.Status().Code != codes.Error || spanAttributes(span)["http.response.status_code"].AsInt64() != 500 {
		t.Fatalf("status=%v attrs=%v", span.Status(), span.Attributes())
	}
}

func TestTelemetryUnmatchedRouteHasNoRoute(t *testing.T) {
	r, spans, _ := telemetryRouter(t)
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("PROPFIND", "/random-secret", nil))
	span := spans.Ended()[0]
	attrs := spanAttributes(span)
	if _, ok := attrs["http.route"]; ok || span.Name() != "_OTHER" || attrs["http.request.method"].AsString() != "_OTHER" {
		t.Fatalf("name=%q attrs=%v", span.Name(), attrs)
	}
}

type spanContextHandler struct {
	slog.Handler
	traced *bool
}

func (spanContextHandler) Enabled(context.Context, slog.Level) bool { return true }

func (h spanContextHandler) Handle(ctx context.Context, record slog.Record) error {
	*h.traced = trace.SpanContextFromContext(ctx).IsValid()
	return nil
}

func TestLogCarriesSpanContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var traced bool
	r := gin.New()
	r.Use(Telemetry(sdktrace.NewTracerProvider(), sdkmetric.NewMeterProvider()), Log(slog.New(spanContextHandler{slog.DiscardHandler, &traced})))
	r.GET("/", func(c *gin.Context) { c.Status(204) })
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if !traced {
		t.Fatal("request log has no span context")
	}
}
