package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"logvue/assets"
	"logvue/handlers"
	"logvue/parser"
	"logvue/service"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/acme/autocert"
)

func startServer(port int, tlsEnabled bool, domain string, httpsPort int) error {
	autoParser := parser.NewAutoDetectParser()
	logService := service.NewLogService(autoParser)

	r := mux.NewRouter()

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Origin")

			if r.Method == http.MethodOptions {
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	sessionHandler := handlers.NewSessionHandler(logService)
	uploadHandler := handlers.NewUploadHandler(logService)
	filterHandler := handlers.NewFilterHandler(logService)
	timelineHandler := handlers.NewTimelineHandler(logService)
	entryHandler := handlers.NewEntryHandler(logService)
	metadataHandler := handlers.NewMetadataHandler(logService)

	r.HandleFunc("/health", handlers.HealthHandler).Methods(http.MethodGet)
	r.HandleFunc("/api/session", sessionHandler.ServeHTTP).Methods(http.MethodGet)
	r.HandleFunc("/api/logs/upload", uploadHandler.ServeHTTP).Methods(http.MethodPost)
	r.HandleFunc("/api/logs/filter", filterHandler.ServeHTTP).Methods(http.MethodPost)
	r.HandleFunc("/api/logs/timeline", timelineHandler.ServeHTTP).Methods(http.MethodGet)
	r.HandleFunc("/api/logs/entry", entryHandler.ServeHTTP).Methods(http.MethodGet)
	r.HandleFunc("/api/logs/metadata", metadataHandler.ServeHTTP).Methods(http.MethodGet)

	// Serve static files from embedded frontend build output
	r.PathPrefix("/").Handler(http.FileServer(http.FS(assets.FS)))

	// Graceful shutdown handler
	shutdownCh := make(chan error, 1)
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		shutdownCh <- nil
	}()

	if tlsEnabled {
		// HTTPS with Let's Encrypt autocert
		httpsAddr := ":" + strconv.Itoa(httpsPort)

		certManager := autocert.Manager{
			Prompt:     autocert.AcceptTOS,
			HostPolicy: autocert.HostWhitelist(domain),
			Cache:      autocert.DirCache(fmt.Sprintf(".autocert-cache")),
		}

		tlsConfig := certManager.TLSConfig()
		tlsConfig.MinVersion = tls.VersionTLS12

		httpsServer := &http.Server{
			Addr:    httpsAddr,
			Handler: r,
		}

		// HTTP server for ACME challenges and redirects
		httpServer := &http.Server{
			Addr: fmt.Sprintf(":%d", port),
			Handler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				if req.URL.Path == "/.well-known/acme-challenge/" {
					certManager.HTTPHandler(nil).ServeHTTP(w, req)
					return
				}
				target := fmt.Sprintf("https://%s%s", domain, req.URL.Path)
				if req.URL.RawQuery != "" {
					target += "?" + req.URL.RawQuery
				}
				http.Redirect(w, req, target, http.StatusMovedPermanently)
			}),
		}

		go func() {
			log.Printf("HTTP server starting on port %d (redirecting to HTTPS)", port)
			if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("HTTP server error: %v", err)
			}
		}()

		go func() {
			log.Printf("HTTPS server starting on addr %s (Let's Encrypt)", httpsAddr)
			if err := httpsServer.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
				log.Printf("HTTPS server error: %v", err)
			}
		}()

		<-shutdownCh
		return httpsServer.Shutdown(context.Background())
	}

	// Plain HTTP mode
	addr := ":" + strconv.Itoa(port)
	server := &http.Server{Addr: addr, Handler: r}

	go func() {
		<-shutdownCh
		server.Shutdown(context.Background())
		os.Remove(pidFile)
	}()

	log.Printf("Server starting on addr http://localhost%s", addr)
	return server.ListenAndServe()
}
