package api

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Ayush1388/log-aggregator/internal/models"
	"github.com/Ayush1388/log-aggregator/internal/storage"
)

const maxIngestBodyBytes = 1 << 20 // 1 MiB

// HandleHealth is a liveness probe for orchestrators.
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}

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
	if subtle.ConstantTimeCompare([]byte(authHeader), []byte("Bearer "+expectedToken)) != 1 {
		http.Error(
			w,
			`{"error":"unauthorized: invalid token"}`,
			http.StatusUnauthorized,
		)
		return
	}

	var payload models.LogPayload

	r.Body = http.MaxBytesReader(w, r.Body, maxIngestBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	payload.Level = strings.ToUpper(strings.TrimSpace(payload.Level))
	if payload.Level == "" {
		payload.Level = "INFO"
	}
	if payload.ServiceID == "" {
		payload.ServiceID = "unknown-service"
	}
	// A zero timestamp would land in the default partition and break
	// later partition creation for that month.
	if payload.Timestamp.IsZero() {
		payload.Timestamp = time.Now().UTC()
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
	level = strings.ToUpper(level)

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
