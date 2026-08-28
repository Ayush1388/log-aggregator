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
	// LogQueue is a send-only channel. The HTTP handler only produces data.
	LogQueue chan<- models.LogPayload
}

func (h *IngestHandler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	expectedToken := os.Getenv("INGEST_TOKEN")
	if expectedToken == "" {
		expectedToken = "my-secret-dev-token"
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader != "Bearer "+expectedToken {
		http.Error(
			w,
			`{"error":"unauthorized: invalid token"}`,
			http.StatusUnauthorized,
		)
		return
	}

	var payload models.LogPayload

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	select {
	case h.LogQueue <- payload:
		w.WriteHeader(http.StatusAccepted)

	default:
		http.Error(
			w,
			`{"error":"queue full, try again later"}`,
			http.StatusServiceUnavailable,
		)
	}
}

type QueryHandler struct {
	DB *storage.Storage
}

func (h *QueryHandler) HandleGetLogs(w http.ResponseWriter, r *http.Request) {
	serviceID := r.URL.Query().Get("service_id")
	level := r.URL.Query().Get("level")

	limit := 50
	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 {
			http.Error(
				w,
				`{"error":"limit must be a positive integer"}`,
				http.StatusBadRequest,
			)
			return
		}

		// Protect the API from accidentally requesting huge pages.
		if parsed > 100 {
			parsed = 100
		}

		limit = parsed
	}

	offset := 0
	if value := r.URL.Query().Get("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 {
			http.Error(
				w,
				`{"error":"offset must be a non-negative integer"}`,
				http.StatusBadRequest,
			)
			return
		}

		offset = parsed
	}

	result, err := h.DB.GetLogs(serviceID, level, limit, offset)
	if err != nil {
		http.Error(
			w,
			`{"error":"failed to fetch logs"}`,
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(result); err != nil {
		http.Error(
			w,
			`{"error":"failed to encode logs response"}`,
			http.StatusInternalServerError,
		)
	}
}
