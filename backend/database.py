import psycopg2
from psycopg2.pool import SimpleConnectionPool
from contextlib import contextmanager
from .config import settings

pool = SimpleConnectionPool(
    minconn=1, maxconn=10,
    host=settings.POSTGRES_HOST,
    user=settings.POSTGRES_USER,
    password=settings.POSTGRES_PASSWORD,
    port=settings.POSTGRES_PORT,
    dbname=settings.POSTGRES_DB
)

@contextmanager
def get_connection():
    """Yields a DB connection from pool and ensures it is returned after use."""
    conn = None
    try:
        conn = pool.getconn()
        yield conn
    finally:
        if conn:
            pool.putconn(conn)


get_db = get_connection

def init_postgres():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_logs (
                    id UUID PRIMARY KEY,
                    device_id VARCHAR(100) NOT NULL,
                    sequence_number INTEGER NOT NULL,
                    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                    payload_type VARCHAR(50) NOT NULL,
                    measured_temperature DECIMAL(10,2),
                    true_temperature DECIMAL(10,2),
                    remaining_shelf_life DECIMAL(10,2),
                    received_at TIMESTAMPTZ DEFAULT NOW(),
                    is_replayed BOOLEAN DEFAULT FALSE,
                    compressor_state VARCHAR(50),
                    CONSTRAINT unique_device_seq UNIQUE(device_id, sequence_number)
                );
                CREATE INDEX IF NOT EXISTS idx_telemetry_device_time 
                ON telemetry_logs(device_id, timestamp DESC
                );
            """)

            # Incidents Table (with TTR tracking)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id SERIAL PRIMARY KEY,
                    device_id VARCHAR(64) NOT NULL,
                    incident_type VARCHAR(64) NOT NULL, -- HIGH_TEMP, HEARTBEAT_TIMEOUT
                    severity VARCHAR(16) NOT NULL,      -- WARNING, CRITICAL
                    detail TEXT,
                    opened_at TIMESTAMPTZ NOT NULL,
                    resolved_at TIMESTAMPTZ,
                    ttr_seconds NUMERIC(10,2),          -- Calculated Time To Recovery
                    status VARCHAR(16) DEFAULT 'OPEN'   -- OPEN, RESOLVED
                );
            """)

            # SLA & Telemetry Completeness Audit Table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sla_audits (
                    id SERIAL PRIMARY KEY,
                    device_id VARCHAR(64) NOT NULL,
                    min_seq BIGINT,
                    max_seq BIGINT,
                    expected_packets BIGINT,
                    received_packets BIGINT,
                    missing_packets_count BIGINT,
                    completeness_pct NUMERIC(5,2),
                    evaluated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            conn.commit()