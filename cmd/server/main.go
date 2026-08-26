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
	dsn := "postgres://postgres:password@localhost:5432/postgres?sslmode=disable"
	db, err := storage.NewStorage(dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	// Initialize the buffered channel
	// we use a buffered channel to allow for some temporary storage of log payloads before they are processed.
	// it to absorb temporary spikes in traffic.
	//capacity of 10,000 means it can hold 10k logs in RAM before the server starts rejecting new requests.
	logQueue := make(chan models.LogPayload, 10000)

	proc :=processor.NewProcessor(logQueue, 100, 5*time.Second,db)
	proc.Start(3)

	//2- initialize the HTTP server and register the handler
	handler := &api.IngestHandler{
		LogQueue: logQueue,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest", handler.HandleIngest)

	server:= &http.Server{
		Addr: ":8080",
		Handler: mux,
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
