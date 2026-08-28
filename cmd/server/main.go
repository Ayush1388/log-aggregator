package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Ayush1388/log-aggregator/internal/api"
	"github.com/Ayush1388/log-aggregator/internal/models"
	"github.com/Ayush1388/log-aggregator/internal/processor"
	"github.com/Ayush1388/log-aggregator/internal/storage"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("FATAL: DATABASE_URL environment variable is not set")
	}
	db, err := storage.NewStorage(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	// Start automatic 3-month partition retention.
	maintenanceCtx, maintenanceCancel := context.WithCancel(context.Background())
	defer maintenanceCancel()
	go db.StartMaintenanceManager(maintenanceCtx, 3)

	// Run the startup sweep to clear old logs

	// Initialize the buffered channel
	// we use a buffered channel to allow for some temporary storage of log payloads before they are processed.
	// it to absorb temporary spikes in traffic.
	//capacity of 10,000 means it can hold 10k logs in RAM before the server starts rejecting new requests.
	logQueue := make(chan models.LogPayload, 10000)

	proc := processor.NewProcessor(logQueue, 100, 5*time.Second, db)
	proc.Start(3)

	//2- initialize the HTTP server and register the handler
	ingestHandler := &api.IngestHandler{
		LogQueue: logQueue,
	}
	queryHandler := &api.QueryHandler{
		DB: db,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest", ingestHandler.HandleIngest)
	mux.HandleFunc("GET /logs", queryHandler.HandleGetLogs)

	// --- NEW CORS MIDDLEWARE ---
	// This tells the browser: "It is safe to let the React app fetch this data"
	corsMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

			// If it's an OPTIONS preflight request, just say OK and return early
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}

	// Wrap the mux with our new CORS middleware!
	server := &http.Server{
		Addr:    ":8080",
		Handler: corsMiddleware(mux),
	}

	go func() {
		log.Println("Starting server on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()
	// 5. Graceful Shutdown Implementation
	// Listen for Ctrl+C (SIGINT) or Docker/K8s shutdown (SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit // Blocks here until a signal is received!

	log.Println("\nShutdown signal received. Commencing graceful shutdown...")
	maintenanceCancel()
	// Stop accepting new HTTP requests
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(ctx)

	// Close the channel. This tells the workers: "No more logs are coming."
	close(logQueue)

	// Wait for workers to flush whatever is left in their batches
	proc.Wait()

	log.Println("Shutdown complete. All logs safely flushed.")

}
