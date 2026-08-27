package api

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	"github.com/Ayush1388/log-aggregator/internal/models"
	"github.com/Ayush1388/log-aggregator/internal/storage"
)

type IngestHandler struct {
	//LogQueue is a send-only channel. the HTTP handler only produces data.
	LogQueue chan<- models.LogPayload
}

func (h *IngestHandler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	// 1. SECURITY CHECK: Verify the token before doing anything else
	expectedToken := os.Getenv("INGEST_TOKEN")
	if expectedToken == "" {
		expectedToken = "my-secret-dev-token" // Fallback for local testing
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader != "Bearer "+expectedToken {
		http.Error(w, `{"error":"unauthorized: invalid token"}`, http.StatusUnauthorized)
		return
	}

	var payload models.LogPayload
	//1. decode the json payload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	//2.non-blocking channel push(backpressure pattern)
	select {
	case h.LogQueue <- payload:
		//success: the log is now in the buffer.
		//return 202 accepted:
		w.WriteHeader(http.StatusAccepted)
	default:
		//default trigger IMMEDISTELY if the channel buffer is full.
		//this protects the server from OOM crashes by sheddng load.
		http.Error(w, `{"error":"queue full, try again later"}`, http.StatusServiceUnavailable)
	}
}

// Create a new struct for handling queries that has access to the database
type QueryHandler struct {
	DB *storage.Storage
}

func (h *QueryHandler) HandleGetLogs(w http.ResponseWriter, r *http.Request) {
	// 1. Grab filter parameters from the URL
	serviceID := r.URL.Query().Get("service_id")
	level := r.URL.Query().Get("level")

	// 2. Safely parse Pagination parameters (default to 50 logs per page)
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	// 3. Fetch data from the database
	logs, err := h.DB.GetLogs(serviceID, level, limit, offset)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch logs"}`, http.StatusInternalServerError)
		return
	}

	// 4. Send the JSON response to the user
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
