<div align="center">

# Log Aggregator

**A high-throughput, self-hosted log pipeline built in Go.**

[**Live demo**](https://log-aggregator-pml5.onrender.com) · [Quick start](#quick-start) · [Use it in your project](#use-it-in-your-project) · [API](#api)

![Go](https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=flat&logo=docker&logoColor=white)

</div>

Services send JSON logs to one HTTP endpoint. The Go backend queues them in memory, writes them to PostgreSQL in batches, and a React dashboard lets you run a load test and browse the results.

> The live demo runs on a free tier. If it has been idle, the first request can take about 30 seconds to wake the server.

## Live demo

Open the [live demo](https://log-aggregator-pml5.onrender.com) and click **Send 10,000 / 15,000 / 20,000 logs**. The server fires that many real HTTP requests at its own `/ingest` endpoint, and the dashboard animates each stage (requests arrive, the queue absorbs them, workers batch them, Postgres stores them). When the run ends it reports throughput, logs lost, database writes and queue pushbacks.

Typical local result for 20,000 logs: about 20,000 logs per second accepted, 0 lost, around 200 database writes instead of 20,000 single inserts.

The dashboard has three views: **Live run**, **Logs** (filter by level, paginate, inspect metadata) and **Where it fits** (a step-by-step integration guide).

## How it works

```text
 clients ──► POST /ingest ──► bounded queue ──► 3 workers ──► PostgreSQL
              (token auth)    (10,000 logs)    (batch of 100    (monthly
                                                or every 5 s)    partitions)
```

* **Backpressure:** the queue is a buffered Go channel. When it is full the API returns `503`, so clients back off instead of exhausting memory.
* **Batching:** each worker flushes after 100 logs or 5 seconds, using one parameterised multi-row `INSERT`. Failed flushes retry with exponential backoff.
* **Partitioning:** logs are stored in monthly PostgreSQL partitions. The backend creates the current and next two months, and drops partitions older than three months.
* **Metadata:** arbitrary JSON is stored as `JSONB`.
* **Graceful shutdown:** on `SIGTERM` the server stops accepting requests and flushes whatever is still queued.
* **Schema on startup:** the backend creates its own tables, so a managed database needs no manual setup.

## Quick start

```bash
git clone https://github.com/Ayush1388/log-aggregator.git
cd log-aggregator
cp .env.example .env        # set POSTGRES_PASSWORD and INGEST_TOKEN
docker compose up --build -d
```

| Service | URL |
| --- | --- |
| Dashboard | http://localhost:3000 |
| API | http://localhost:8080 |

Without Docker: run PostgreSQL, then

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/db?sslmode=disable"
export INGEST_TOKEN="your-token"
cd web && npm install && npm run build && cd ..
STATIC_DIR=web/dist go run ./cmd/server      # dashboard and API on :8080
```

## Use it in your project

1. **Get an endpoint and a token.** Run your own copy (above) or [deploy it](#deployment), and set `INGEST_TOKEN` to a long random string.
2. **Add the client.** For Node.js copy [`sdk/node/logger.js`](sdk/node/logger.js) into your project. It has no dependencies. Other languages can call the HTTP endpoint directly.
3. **Send a log.**

   ```javascript
   import { Logger } from './logger.js';

   const logger = new Logger({
     endpoint: "https://your-host/ingest",
     token: process.env.LOG_TOKEN,
     serviceId: "payment-service",
   });

   logger.info("Order created", { order_id: 1042 });
   logger.error("Payment failed", { user_id: 88471, retry: 3 });
   ```

4. **Open the dashboard.** Logs appear within a few seconds (batches flush at 100 logs or every 5 s).

The same guide, with copy buttons and the live endpoint filled in, is on the **Where it fits** tab of the dashboard.

## API

| Endpoint | Method | Description | Auth |
| --- | --- | --- | --- |
| `/ingest` | `POST` | Push one log event. Returns `202`, `401` (bad token) or `503` (queue full). | Bearer token |
| `/logs` | `GET` | Paginated logs with `level` and `service_id` filters, plus global counts. | None |
| `/health` | `GET` | Liveness check. | None |
| `/demo/run?count=10000` | `POST` | Start a load-test run (10000, 15000 or 20000; one at a time). | None |
| `/demo/status` | `GET` | Live progress and final result of the run. | None |
| `/demo/clear` | `POST` | Delete demo-generated logs. | None |

```bash
curl -X POST http://localhost:8080/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -d '{"service_id":"payment-service","level":"ERROR","message":"Payment failed","metadata":{"user_id":88471}}'

curl "http://localhost:8080/logs?level=ERROR&limit=50&offset=0"
```

`level` is one of `ERROR`, `WARN`, `INFO`, `DEBUG`. If `timestamp` is omitted the server uses the current time. Set `DEMO_ENABLED=false` to turn the `/demo` endpoints off.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | PostgreSQL connection string |
| `INGEST_TOKEN` | `my-secret-dev-token` | Bearer token for `/ingest`. Always set your own. |
| `PORT` | `8080` | HTTP port |
| `STATIC_DIR` | unset | Serve a built React app from this folder |
| `DEMO_ENABLED` | `true` | Enable the `/demo` endpoints |

## Deployment

The backend is a long-running process (in-memory queue, worker goroutines, a flush timer), so it needs a real server rather than serverless functions.

* **Backend and dashboard together:** [`render.yaml`](render.yaml) and [`Dockerfile.render`](Dockerfile.render) build one image that serves both. Point `DATABASE_URL` at any PostgreSQL, such as [Neon](https://neon.tech), which has a free tier that does not expire.
* **Keeping a free tier awake:** [`.github/workflows/keep-awake.yml`](.github/workflows/keep-awake.yml) pings `/health` every 5 minutes.
* **Frontend on its own host:** build `web/` with `VITE_API_URL=https://your-backend`.

## Load testing

You can also drive the endpoint yourself with ApacheBench:

```bash
ab -n 10000 -c 100 -p payload.json -T application/json \
  -H "Authorization: Bearer $INGEST_TOKEN" http://localhost:8080/ingest
```

## Project structure

```text
cmd/server/          entry point, routing, static file serving
internal/api/        ingest, query and demo handlers
internal/processor/  worker pool and batching
internal/storage/    PostgreSQL access, schema, partitions, retention
internal/demo/       load-test runner behind the dashboard
sdk/node/            dependency-free Node.js client
web/                 React dashboard (Vite, Tailwind)
```
