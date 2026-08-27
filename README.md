<div align="center">
  
  # 📊 Log Aggregator & Observability Stack
  **A high-throughput, self-hosted telemetry pipeline built in Go.**

  ![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

</div>

<br />

A lightweight, high-performance alternative to enterprise APM tools (like Datadog or New Relic). It processes massive volumes of telemetry data using concurrent background workers, leveraging PostgreSQL for time-series storage and dynamic JSONB metadata mapping.

## ✨ Key Features

* **Concurrent Ingestion:** Go channels implement a backpressure pattern, shedding load during traffic spikes to prevent OOM crashes.
* **Optimized Batch Processing:** Background worker pools group logs and execute bulk inserts, drastically reducing database connection overhead.
* **Schemaless Metadata:** Attaches arbitrary, deeply nested JSON data to logs using PostgreSQL `JSONB` without requiring schema migrations.
* **Datadog-Style UI:** A React and Tailwind frontend featuring expandable state trees for visualizing complex telemetry.
* **Containerized:** Fully Dockerized with multi-stage builds for a zero-friction deployment.

## 🏗️ Architecture

```text
[ Microservices / SDK ] 
        │
        ▼ (HTTP POST /ingest)
┌─────────────────────────────────┐
│           Go Backend            │
│  ├─ API Handler                 │
│  ├─ Buffered Channel (Queue)    │
│  └─ Worker Pool (Batching)      │
└───────────────┬─────────────────┘
                │ (Bulk Insert)
        ▼
[ PostgreSQL Database (JSONB) ]
        │
        ▼ (HTTP GET /logs)
[ React Dashboard ]
```

## 🚀 Quick Start

Deploy the entire distributed system locally in under 60 seconds.

### 1. Boot the Stack

```bash
git clone [https://github.com/Ayush1388/log-aggregator.git](https://github.com/Ayush1388/log-aggregator.git)
cd log-aggregator
docker compose up --build -d
```

### 2. Initialize the Schema

```bash
docker exec -it log-aggregator-db-1 psql -U postgres -d logaggregator -c "
CREATE TABLE logs (
  service_id VARCHAR(255), 
  level VARCHAR(50), 
  message TEXT, 
  timestamp TIMESTAMPTZ NOT NULL, 
  metadata JSONB
);"
```

Access the dashboard at `http://localhost:3000`.

## 🔌 Node.js SDK Integration

A lightweight, non-blocking client SDK is included for seamless integration.

```javascript
import { Logger } from './sdk/node/logger.js';

const logger = new Logger({
  endpoint: "http://localhost:8080/ingest",
  token: "my-secret-dev-token",
  serviceId: "payment-service"
});

// Send logs with deeply nested JSON metadata
logger.error("Failed to process payment", { 
    user_id: 88471, 
    cart_total: 129.99,
    retry_attempt: 3
});
```

## 📈 API Reference

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/ingest` | `POST` | Push a single log or metric event | `Bearer Token` |
| `/logs` | `GET` | Fetch logs with pagination and filters | None |
| `/health` | `GET` | Service healthcheck for orchestrators | None |
