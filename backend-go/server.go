package main

import (
	"log"
	. "logvue/assets"
	"logvue/handlers"
	"logvue/parser"
	"logvue/service"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/gorilla/mux"
)

func startServer(port int) error {
	autoParser := parser.NewAutoDetectParser()
	logService := service.NewLogService(autoParser)

	r := mux.NewRouter()

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
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

	addr := ":" + strconv.Itoa(port)
	server := &http.Server{Addr: addr, Handler: r}

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		server.Shutdown(nil)
		os.Remove(pidFile)
	}()

	log.Printf("Server starting on port %d", port)
	return server.ListenAndServe()
}
