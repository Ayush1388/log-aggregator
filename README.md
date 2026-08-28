<div align="center">

# 📊 Log Aggregator & Observability Stack

**A high-throughput, self-hosted telemetry pipeline built in Go.**

![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge\&logo=go\&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge\&logo=postgresql\&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge\&logo=react\&logoColor=61DAFB)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge\&logo=docker\&logoColor=white)

</div>

<br />

A lightweight, high-performance log aggregation platform built with Go, PostgreSQL, React, and Docker. It processes incoming telemetry through a concurrent worker pipeline, batches events for efficient database writes, and provides a dashboard for filtering and browsing stored logs.

## ✨ Key Features

* **Concurrent Ingestion:** Go channels implement a bounded buffering and backpressure pattern to absorb traffic spikes without allowing unbounded memory growth.
* **Worker Pool:** Multiple background workers consume logs concurrently from the ingestion queue.
* **Optimized Batch Processing:** Logs are flushed when the batch reaches 100 events or after 5 seconds, reducing database round trips.
* **Bulk PostgreSQL Inserts:** Batched logs are inserted using dynamically generated parameterized SQL in a single database operation.
* **Time-Based Partitioning:** PostgreSQL stores logs in monthly partitions based on the event timestamp.
* **Automatic Partition Management:** The backend automatically creates the current and upcoming monthly partitions.
* **Automatic Retention:** Expired monthly partitions are automatically removed after the configured retention period.
* **Schemaless Metadata:** Arbitrary structured metadata is stored using PostgreSQL `JSONB` without requiring schema changes.
* **Filtering & Pagination:** Logs can be filtered by service and level and retrieved in pages instead of loading the entire dataset at once.
* **Global Dashboard Statistics:** The API returns overall event counts for ERROR, WARN, INFO, and DEBUG alongside the current page of logs.
* **Datadog-Style UI:** A React and Tailwind frontend provides filtering, pagination, live refresh, dark mode, and expandable metadata.
* **Node.js SDK:** A lightweight SDK is included for sending structured logs from Node.js applications.
* **Graceful Shutdown:** The backend flushes remaining queued logs before shutting down.
* **Containerized:** The complete stack runs with Docker Compose and uses multi-stage builds for the Go backend and React frontend.

## 🏗️ Architecture

```text
[ Microservices / SDK ]
          │
          ▼
    HTTP POST /ingest
          │
┌─────────────────────────────────┐
│           Go Backend            │
│                                 │
│  ├─ Bearer Token Auth           │
│  ├─ Buffered Channel Queue      │
│  ├─ Worker Pool                 │
│  └─ Batch Processor             │
└───────────────┬─────────────────┘
                │
                │ Bulk Insert
                ▼
┌─────────────────────────────────┐
│          PostgreSQL             │
│                                 │
│  ├─ JSONB Metadata              │
│  ├─ Monthly Time Partitions     │
│  └─ Automatic Retention         │
└───────────────┬─────────────────┘
                │
                │ GET /logs
                ▼
┌─────────────────────────────────┐
│        React Dashboard          │
│                                 │
│  ├─ Filtering                   │
│  ├─ Pagination                  │
│  ├─ Global Statistics           │
│  ├─ Live Refresh                │
│  └─ Metadata Inspection         │
└─────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Ayush1388/log-aggregator.git
cd log-aggregator
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_DB=logaggregator
INGEST_TOKEN=your-ingest-token
```

A template is available in `.env.example`.

### 3. Boot the stack

```bash
docker compose up --build -d
```

This starts the PostgreSQL database, Go backend, and React frontend.

The database schema and initial partitions are created automatically.

### 4. Open the dashboard

```text
http://localhost:3000
```

Backend:

```text
http://localhost:8080
```

## 🔌 Node.js SDK Integration

A lightweight, non-blocking client SDK is included for seamless integration.

```javascript
import { Logger } from './sdk/node/logger.js';

const logger = new Logger({
  endpoint: "http://localhost:8080/ingest",
  token: "my-secret-dev-token",
  serviceId: "payment-service"
});

// Send logs with structured JSON metadata
logger.error("Failed to process payment", { 
    user_id: 88471, 
    cart_total: 129.99,
    retry_attempt: 3
});
```

## 📈 API Reference

| Endpoint  | Method | Description                                             | Auth Required  |
| --------- | ------ | ------------------------------------------------------- | -------------- |
| `/ingest` | `POST` | Push a single log event                                 | `Bearer Token` |
| `/logs`   | `GET`  | Fetch paginated logs with filters and global statistics | None           |
| `/health` | `GET`  | Service healthcheck for orchestrators                   | None           |

### Ingest a log

```bash
curl -X POST http://localhost:8080/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-dev-token" \
  -d '{
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "Failed to process payment",
    "timestamp": "2026-08-28T16:00:00Z",
    "metadata": {
      "user_id": 88471,
      "retry_attempt": 3
    }
  }'
```

Successful requests return:

```text
202 Accepted
```

### Query logs

The `/logs` endpoint supports pagination and filtering.

```bash
curl "http://localhost:8080/logs?limit=50&offset=0"
```

Filter by level:

```bash
curl "http://localhost:8080/logs?level=ERROR&limit=50&offset=0"
```

Filter by service:

```bash
curl "http://localhost:8080/logs?service_id=payment-service&limit=50&offset=0"
```

Example response:

```json
{
  "logs": [
    {
      "service_id": "payment-service",
      "level": "ERROR",
      "message": "Failed to process payment",
      "timestamp": "2026-08-28T16:00:00Z",
      "metadata": {
        "user_id": 88471
      }
    }
  ],
  "total": 10001,
  "global_stats": {
    "total": 10001,
    "error": 100,
    "warn": 500,
    "info": 9300,
    "debug": 101
  }
}
```

The `logs` array contains only the requested page, while `global_stats` provides aggregate counts across the stored logs.

## 📊 Load Testing

The ingestion endpoint was tested locally using ApacheBench:

```bash
ab -n 10000 -c 100 \
  -p payload.json \
  -T application/json \
  -H "Authorization: Bearer my-secret-dev-token" \
  http://localhost:8080/ingest
```

Example local benchmark:

```text
10,000 requests
100 concurrent clients
0 failed requests
~11,000 requests/sec
```

The test was followed by a PostgreSQL verification confirming that the generated logs were persisted successfully.

## 🗂️ Project Structure

```text
log-aggregator/
├── cmd/
│   └── server/
│       └── main.go
│
├── internal/
│   ├── api/
│   │   └── handlers.go
│   ├── models/
│   │   └── log.go
│   ├── processor/
│   │   └── processor.go
│   └── storage/
│       ├── db.go
│       ├── partitions.go
│       └── retention.go
│
├── sdk/
│   └── node/
│       ├── app.js
│       ├── logger.js
│       ├── package.json
│       └── package-lock.json
│
├── web/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── Dockerfile
├── docker-compose.yml
├── init.sql
├── payload.json
├── .env.example
├── go.mod
├── go.sum
└── README.md
```
