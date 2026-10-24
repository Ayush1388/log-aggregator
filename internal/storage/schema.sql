-- ============================================================
-- Log Aggregator Database Initialization
-- PostgreSQL 18
-- Native time-based partitioning
-- ============================================================


-- ============================================================
-- 1. Create the partitioned parent table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.logs (
    service_id VARCHAR(255),
    level      VARCHAR(50),
    message    TEXT,
    timestamp  TIMESTAMPTZ NOT NULL,
    metadata   JSONB
) PARTITION BY RANGE (timestamp);


-- ============================================================
-- 2. Default partition
--
-- Any timestamp that does not belong to a known monthly
-- partition lands here rather than causing the INSERT to fail.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.logs_default
    PARTITION OF public.logs DEFAULT;


-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_logs_level
    ON public.logs(level);

CREATE INDEX IF NOT EXISTS idx_logs_service_id
    ON public.logs(service_id);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp
    ON public.logs(timestamp DESC);