package processor

import (
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Ayush1388/log-aggregator/internal/models"
	"github.com/Ayush1388/log-aggregator/internal/storage"
)

// to manage the worker pool and the batching logic
type Processor struct {
	LogQueue      <-chan models.LogPayload //receive-only channel
	wg            sync.WaitGroup
	batchSize     int
	flushInterval time.Duration
	storage       *storage.Storage

	flushedLogs    atomic.Int64
	flushedBatches atomic.Int64
	droppedLogs    atomic.Int64
}

// maxPendingBatches caps how many batches a worker keeps in memory while the
// database is failing, so a long outage cannot grow memory without bound.
const maxPendingBatches = 50

// Stats is a point-in-time snapshot of the processor counters.
type Stats struct {
	FlushedLogs    int64 `json:"flushed_logs"`
	FlushedBatches int64 `json:"flushed_batches"`
	DroppedLogs    int64 `json:"dropped_logs"`
}

// Stats returns the number of logs persisted, batches written and logs dropped.
func (p *Processor) Stats() Stats {
	return Stats{
		FlushedLogs:    p.flushedLogs.Load(),
		FlushedBatches: p.flushedBatches.Load(),
		DroppedLogs:    p.droppedLogs.Load(),
	}
}

//NewProcessor initializes the processor with configurable rules.

func NewProcessor(queue <-chan models.LogPayload, batchSize int, interval time.Duration, store *storage.Storage) *Processor {
	return &Processor{
		LogQueue:      queue,
		batchSize:     batchSize,
		flushInterval: interval,
		storage:       store,
	}
}

// start the worker pool and begin processing logs from the channel
func (p *Processor) Start(workerCount int) {
	for i := 1; i <= workerCount; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
	log.Println("Processor started with", workerCount, "workers")
}

// wait blocks unil all workers have finished processing and excited.
func (p *Processor) Wait() {
	p.wg.Wait()
	log.Println("All workers have finished processing")
}

// worker is the function that each worker goroutine runs to process logs from the channel.
func (p *Processor) worker(workerID int) {
	defer p.wg.Done() //defer executes at the end of the function.
	//ensuring the wait group counter is decremented when the worker exits.
	//1) batch pre allocate memory
	batch := make([]models.LogPayload, 0, p.batchSize)
	//2) create a ticker for the flush interval
	ticker := time.NewTicker(p.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case payload, ok := <-p.LogQueue:
			if !ok {
				if len(batch) > 0 {
					if err := p.flushToDB(workerID, batch); err != nil {
						log.Printf(
							"[Worker %d] Final flush failed; %d logs were not persisted.\n",
							workerID,
							len(batch),
						)
						return
					}
				}

				log.Printf("Worker %d exiting: channel closed", workerID)
				return
			}
			batch = append(batch, payload)
			if len(batch) >= p.batchSize {
				if err := p.flushToDB(workerID, batch); err == nil {
					batch = batch[:0]
				} else if len(batch) >= p.batchSize*maxPendingBatches {
					p.droppedLogs.Add(int64(len(batch)))
					log.Printf("[Worker %d] Dropping %d logs after repeated flush failures", workerID, len(batch))
					batch = batch[:0]
				}
			}
		case <-ticker.C:
			if len(batch) > 0 {
				if err := p.flushToDB(workerID, batch); err == nil {
					batch = batch[:0]
				}
			}

		}
	}
}
func (p *Processor) flushToDB(workerID int, batch []models.LogPayload) error {
	const (
		maxRetries   = 5
		initialDelay = 500 * time.Millisecond
	)

	for attempt := 1; attempt <= maxRetries; attempt++ {
		err := p.storage.BulkInsert(batch)
		if err == nil {
			p.flushedLogs.Add(int64(len(batch)))
			p.flushedBatches.Add(1)
			log.Printf(
				"[Worker %d] Successfully flushed %d logs to PostgreSQL.\n",
				workerID,
				len(batch),
			)
			return nil
		}

		log.Printf(
			"[Worker %d] Flush attempt %d/%d failed for %d logs: %v",
			workerID,
			attempt,
			maxRetries,
			len(batch),
			err,
		)

		if attempt == maxRetries {
			return fmt.Errorf(
				"failed to flush batch after %d attempts: %w",
				maxRetries,
				err,
			)
		}

		delay := initialDelay * time.Duration(1<<(attempt-1))

		log.Printf(
			"[Worker %d] Retrying in %v...",
			workerID,
			delay,
		)

		time.Sleep(delay)
	}

	return nil
}
