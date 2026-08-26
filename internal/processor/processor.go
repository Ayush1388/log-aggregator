package processor

import (
	"log"
	"sync"
	"time"
	"github.com/Ayush1388/log-aggregator/internal/storage"
	"github.com/Ayush1388/log-aggregator/internal/models"
)

//to manage the worker pool and the batching logic
type Processor struct {
	LogQueue 	 <-chan models.LogPayload //receive-only channel
	wg   		 sync.WaitGroup
	batchSize 	 int
	flushInterval time.Duration
	storage       *storage.Storage
}

//NewProcessor initializes the processor with configurable rules.

func NewProcessor(queue <-chan models.LogPayload, batchSize int, interval time.Duration,store *storage.Storage) *Processor {
	return &Processor{
			LogQueue: queue,
			batchSize: batchSize,
			flushInterval: interval,
			storage:       store,
	}
}

// start the worker pool and begin processing logs from the channel
func (p *Processor) Start(workerCount int) {
	for i := 1; i < workerCount; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
	log.Println("Processor started with", workerCount, "workers")
}

//wait blocks unil all workers have finished processing and excited.
func (p *Processor) Wait() {
	p.wg.Wait()
	log.Println("All workers have finished processing")
}

//worker is the function that each worker goroutine runs to process logs from the channel.
func (p *Processor) worker(workerID int) {
	defer p.wg.Done() //defer executes at the end of the function.
	//ensuring the wait group counter is decremented when the worker exits.
	//1) batch pre allocate memory
	batch := make([]models.LogPayload, 0, p.batchSize)
	//2) create a ticker for the flush interval
	ticker := time.NewTicker(p.flushInterval)
	defer ticker.Stop() 

	for{
		select{
		case payload,ok:= <-p.LogQueue:
			if !ok {
				//channel closed, flush remaining logs and exit
				if len(batch)>0{
				p.flushToDB(workerID,batch)
				}
				log.Printf("Worker %d exiting: channel closed", workerID)
				return
			}
			batch = append(batch, payload)
			if len(batch) >= p.batchSize {
				p.flushToDB(workerID, batch)
				batch = batch[:0] // Clear the batch
			}
		case <- ticker.C:
			if len(batch) > 0 {
				p.flushToDB(workerID, batch)
				batch = batch[:0] // Clear the batch
			}	

		}
	}
}
func (p *Processor) flushToDB(workerID int, batch []models.LogPayload) {
err := p.storage.BulkInsert(batch)
	if err != nil {
		log.Printf("[Worker %d] ERROR flushing %d logs: %v\n", workerID, len(batch), err)
		return
	}
	log.Printf("[Worker %d] Successfully flushed %d logs to PostgreSQL.\n", workerID, len(batch))
}