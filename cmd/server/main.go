package main

import (
	"log"
	"net/http"

	"github.com/Ayush1388/log-aggregator/internal/api"
	"github.com/Ayush1388/log-aggregator/internal/api/models"
)

func main() {
	// Initialize the buffered channel
	// we use a buffered channel to allow for some temporary storage of log payloads before they are processed.
	// it to absorb temporary spikes in traffic.
	//capacity of 10,000 means it can hold 10k logs in RAM before the server starts rejecting new requests.
	logQueue := make(chan models.LogPayload, 10000)

	//temporary: a dummy consumer so that channel doesn't fill up immediately.
	//we will replace this with the actual log processing logic later.
	//called the dual-trigger worker pattern: one goroutine is producing data (the HTTP handler) and another is consuming it (the dummy consumer).
	go func() {
		for range logQueue {
			//discarding logs for now just to keep the channel empty and avoid blocking the HTTP handler.
		}
	}()

	//2- initialize the HTTP server and register the handler
	handler := &api.IngestHandler{
		LogQueue: logQueue,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST/ingest", handler.HandleIngest)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
