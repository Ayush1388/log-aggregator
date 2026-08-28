-- 1. Create the partitioned parent table
CREATE TABLE IF NOT EXISTS logs (
    service_id VARCHAR(255),
    level VARCHAR(50),
    message TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB
) PARTITION BY RANGE (timestamp);

-- 2. Create a default partition so unexpected timestamps never crash the database
CREATE TABLE IF NOT EXISTS logs_default PARTITION OF logs DEFAULT;

-- 3. Create the partition strictly for the current 1 month (August 2026)
CREATE TABLE IF NOT EXISTS logs_2026_08 PARTITION OF logs
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

-- 4. Add high-performance indexes for your React UI filters
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_service_id ON logs(service_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

-- 5. Native Database Function to enforce 1-month retention
CREATE OR REPLACE FUNCTION delete_one_month_old_logs() 
RETURNS void AS $$
BEGIN
    DELETE FROM logs WHERE timestamp < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;