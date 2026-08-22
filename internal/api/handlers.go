package api

import (
	"encoding/json"
	"net/http"

	"github.com/Ayush1388/log-aggregator/internal/api/models"
)

type IngestHandler struct {
	//LogQueue is a send-only channel. the HTTP handler only produces data.
	LogQueue chan<- models.LogPayload
}

func (h *IngestHandler) HandleIngest(w http.ResponseWriter, r *http.Request) {
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
