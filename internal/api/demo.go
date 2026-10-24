package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Ayush1388/log-aggregator/internal/demo"
	"github.com/Ayush1388/log-aggregator/internal/storage"
)

// DemoHandler exposes the load-demo controls used by the dashboard.
type DemoHandler struct {
	Runner *demo.Runner
	DB     *storage.Storage
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

// HandleStart starts a run: POST /demo/run?count=10000
func (h *DemoHandler) HandleStart(w http.ResponseWriter, r *http.Request) {
	count, err := strconv.Atoi(r.URL.Query().Get("count"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "count is required"})
		return
	}
	if err := h.Runner.Start(count); err != nil {
		code := http.StatusBadRequest
		if err.Error() == "a run is already in progress" {
			code = http.StatusConflict
		}
		writeJSON(w, code, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, h.Runner.Snapshot())
}

// HandleStatus returns live progress: GET /demo/status
func (h *DemoHandler) HandleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.Runner.Snapshot())
}

// HandleClear deletes demo logs: POST /demo/clear
func (h *DemoHandler) HandleClear(w http.ResponseWriter, r *http.Request) {
	if st := h.Runner.Snapshot(); st.State == "running" || st.State == "draining" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a run is in progress"})
		return
	}
	n, err := h.DB.ClearDemoLogs()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to clear demo logs"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"deleted": n})
}
