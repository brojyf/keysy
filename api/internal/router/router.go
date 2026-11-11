// Package router registers every HTTP route and the shared middleware chain.
package router

import (
	"log/slog"

	"github.com/brojyf/keysy/api/internal/health"
	"github.com/brojyf/keysy/api/internal/me"
	"github.com/brojyf/keysy/api/internal/member"
	"github.com/brojyf/keysy/api/internal/middleware"
	"github.com/brojyf/keysy/api/internal/org"
	"github.com/brojyf/keysy/api/internal/profile"
	"github.com/brojyf/keysy/api/internal/session"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"gorm.io/gorm"
)

// Deps holds what the routes need. Session authenticates a request before its handler runs.
type Deps struct {
	DB        *gorm.DB
	Logger    *slog.Logger
	WebAppURL string
	Session   gin.HandlerFunc
}

// New builds the engine.
func New(d Deps) *gin.Engine {
	router := gin.New()
	// Registered before the middleware so probes add no spans, metrics, or logs.
	router.GET("/health", health.Get)
	router.Use(
		middleware.Telemetry(otel.GetTracerProvider(), otel.GetMeterProvider()),
		middleware.Recovery(d.Logger),
		middleware.RequestID(),
		middleware.Log(d.Logger),
		middleware.Timeout(),
		middleware.CORS(d.WebAppURL),
	)

	profiles := profile.Store{DB: d.DB}
	sessions := session.Store{DB: d.DB}
	orgs := org.Store{DB: d.DB}
	members := member.Store{DB: d.DB}

	v0 := router.Group("/v0", d.Session)
	v0.OPTIONS("/me")
	v0.GET("/me", me.Get(profiles))
	v0.PATCH("/me", me.Patch(profiles))
	v0.OPTIONS("/me/sessions")
	v0.GET("/me/sessions", session.List(sessions))
	v0.OPTIONS("/me/sessions/:sessionId")
	v0.DELETE("/me/sessions/:sessionId", session.Revoke(sessions))
	v0.OPTIONS("/orgs")
	v0.GET("/orgs", org.List(orgs))
	v0.POST("/orgs", org.Create(orgs))
	v0.OPTIONS("/orgs/:orgId")
	v0.PATCH("/orgs/:orgId", org.Rename(orgs))
	v0.DELETE("/orgs/:orgId", org.Delete(orgs))
	v0.OPTIONS("/orgs/:orgId/members")
	v0.GET("/orgs/:orgId/members", member.List(members))
	return router
}
