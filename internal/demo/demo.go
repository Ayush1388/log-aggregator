// Package demo drives a repeatable load test against the server's own
// /ingest endpoint so the dashboard can show the pipeline working live.
package demo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Ayush1388/log-aggregator/internal/processor"
)

// AllowedCounts are the only run sizes the public demo accepts.
var AllowedCounts = map[int]bool{10000: true, 15000: true, 20000: true}

const concurrency = 100

type Runner struct {
	IngestURL string
	Token     string
	Proc      *processor.Processor
	QueueLen  func() int
	QueueCap  int

	mu     sync.Mutex
	status Status
	client *http.Client
}

// Status is the live state of the current (or last) demo run.
type Status struct {
	State        string  `json:"state"` // idle | running | draining | done
	Target       int     `json:"target"`
	Sent         int64   `json:"sent"`
	Accepted     int64   `json:"accepted"`
	Backpressure int64   `json:"backpressure"`
	Failed       int64   `json:"failed"`
	QueueDepth   int     `json:"queue_depth"`
	QueueCap     int     `json:"queue_cap"`
	Persisted    int64   `json:"persisted"`
	Batches      int64   `json:"batches"`
	AvgBatch     float64 `json:"avg_batch"`
	IngestMs     int64   `json:"ingest_ms"`
	TotalMs      int64   `json:"total_ms"`
	IngestRPS    float64 `json:"ingest_rps"`
	Error        string  `json:"error,omitempty"`
}

func New(ingestURL, token string, proc *processor.Processor, queueLen func() int, queueCap int) *Runner {
	return &Runner{
		IngestURL: ingestURL,
		Token:     token,
		Proc:      proc,
		QueueLen:  queueLen,
		QueueCap:  queueCap,
		status:    Status{State: "idle", QueueCap: queueCap},
		client: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        concurrency * 2,
				MaxIdleConnsPerHost: concurrency * 2,
			},
		},
	}
}

// Start begins a run. It returns an error if one is already in progress.
func (r *Runner) Start(count int) error {
	if !AllowedCounts[count] {
		return fmt.Errorf("count must be 10000, 15000 or 20000")
	}
	r.mu.Lock()
	if r.status.State == "running" || r.status.State == "draining" {
		r.mu.Unlock()
		return fmt.Errorf("a run is already in progress")
	}
	r.status = Status{State: "running", Target: count, QueueCap: r.QueueCap}
	r.mu.Unlock()

	go r.run(count)
	return nil
}

var (
	services = []string{"payment-service", "auth-service", "checkout-service", "inventory-service", "notification-service"}
	messages = map[string][]string{
		"ERROR": {"Payment gateway timeout", "Failed to write to cache", "Upstream returned 502", "Unhandled exception in worker"},
		"WARN":  {"Database connection slow", "Retry attempt scheduled", "Rate limit nearly exceeded", "Disk usage above 80%"},
		"INFO":  {"Request completed", "User signed in", "Order created", "Cache refreshed"},
		"DEBUG": {"Cache miss for key", "Loaded config from env", "Span started", "Query plan selected"},
	}
)

func pickLevel(rng *rand.Rand) string {
	switch n := rng.Intn(100); {
	case n < 5:
		return "ERROR"
	case n < 20:
		return "WARN"
	case n < 85:
		return "INFO"
	default:
		return "DEBUG"
	}
}

func (r *Runner) run(count int) {
	var sent, accepted, backpressure, failed atomic.Int64
	base := r.Proc.Stats()
	start := time.Now()

	jobs := make(chan int)
	var wg sync.WaitGroup
	for w := 0; w < concurrency; w++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(seed))
			for range jobs {
				level := pickLevel(rng)
				svc := services[rng.Intn(len(services))]
				msgs := messages[level]
				body, _ := json.Marshal(map[string]any{
					"service_id": svc,
					"level":      level,
					"message":    msgs[rng.Intn(len(msgs))],
					"timestamp":  time.Now().UTC().Format(time.RFC3339Nano),
					"metadata": map[string]any{
						"demo":       true,
						"request_id": fmt.Sprintf("req-%08x", rng.Uint32()),
						"latency_ms": rng.Intn(900),
					},
				})
				sent.Add(1)
				r.post(body, &accepted, &backpressure, &failed)
			}
		}(time.Now().UnixNano() + int64(w))
	}

	done := make(chan struct{})
	go func() {
		for i := 0; i < count; i++ {
			jobs <- i
		}
		close(jobs)
		wg.Wait()
		close(done)
	}()

	var ingestDur time.Duration
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	ingesting := true
	deadline := time.Now().Add(2 * time.Minute)

	for {
		<-ticker.C
		if ingesting {
			select {
			case <-done:
				ingesting = false
				ingestDur = time.Since(start)
			default:
			}
		}

		ps := r.Proc.Stats()
		persisted := ps.FlushedLogs - base.FlushedLogs
		batches := ps.FlushedBatches - base.FlushedBatches

		st := Status{
			State:        "running",
			Target:       count,
			Sent:         sent.Load(),
			Accepted:     accepted.Load(),
			Backpressure: backpressure.Load(),
			Failed:       failed.Load(),
			QueueDepth:   r.QueueLen(),
			QueueCap:     r.QueueCap,
			Persisted:    persisted,
			Batches:      batches,
			TotalMs:      time.Since(start).Milliseconds(),
		}
		if batches > 0 {
			st.AvgBatch = float64(persisted) / float64(batches)
		}
		if !ingesting {
			st.State = "draining"
			st.IngestMs = ingestDur.Milliseconds()
			if ingestDur > 0 {
				st.IngestRPS = float64(st.Accepted) / ingestDur.Seconds()
			}
			finished := persisted >= st.Accepted
			if finished || time.Now().After(deadline) {
				st.State = "done"
				if !finished {
					st.Error = "timed out waiting for the database"
				}
			}
		}

		r.mu.Lock()
		r.status = st
		r.mu.Unlock()

		if st.State == "done" {
			return
		}
	}
}

// post sends one log, retrying while the queue pushes back (503).
func (r *Runner) post(body []byte, accepted, backpressure, failed *atomic.Int64) {
	for attempt := 0; attempt < 200; attempt++ {
		req, err := http.NewRequest(http.MethodPost, r.IngestURL, bytes.NewReader(body))
		if err != nil {
			failed.Add(1)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+r.Token)

		resp, err := r.client.Do(req)
		if err != nil {
			failed.Add(1)
			return
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()

		switch resp.StatusCode {
		case http.StatusAccepted:
			accepted.Add(1)
			return
		case http.StatusServiceUnavailable:
			backpressure.Add(1)
			time.Sleep(20 * time.Millisecond)
		default:
			failed.Add(1)
			return
		}
	}
	failed.Add(1)
}

// Snapshot returns the current status. While idle it still reports queue depth.
func (r *Runner) Snapshot() Status {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.status
	if st.State == "idle" || st.State == "done" {
		st.QueueDepth = r.QueueLen()
	}
	return st
}
