package main

import (
	"log"
	"net/http"
	"time"

	"github.com/brojyf/keysy/auth/internal/config"
	"github.com/brojyf/keysy/auth/internal/login"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

func main() {
	c, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	handler, err := login.New(login.Options{
		OAuth: oauth2.Config{
			ClientID: c.GoogleClientID, ClientSecret: c.GoogleClientSecret,
			RedirectURL: c.AuthURL + "/v0/auth/callback", Scopes: []string{"openid", "email", "profile"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL: "https://oauth2.googleapis.com/token", AuthStyle: oauth2.AuthStyleInParams,
			},
		},
		SupabaseURL: c.SupabaseURL, SupabaseKey: c.SupabaseKey, WebAppURL: c.WebAppURL,
		CookieKey: c.CookieKey, HTTPClient: login.NewHTTPClient(),
	})
	if err != nil {
		log.Fatal(err)
	}
	gin.SetMode(gin.ReleaseMode)
	// Avoid request logging: callback URLs carry short-lived authorization codes.
	router := gin.New()
	router.HandleMethodNotAllowed = true
	if err := router.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}
	handler.Register(router)
	server := &http.Server{
		Addr: ":" + c.Port, Handler: router, ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 10 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second,
		MaxHeaderBytes: 16 << 10,
	}
	log.Fatal(server.ListenAndServe())
}
