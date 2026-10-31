import sqlite3
import threading
from typing import List, Dict, Any
from ..config import config

class LocalDatabase:
    """A high-reliability data architecture designed to guarantee that messages or tasks 
    are never lost, even if an application crashes or loses network connectivity"""

    def __init__(self, db_path: str = config.DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row

        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self):
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS telemetry (
                    id TEXT PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    sequence_number INTEGER NOT NULL,
                    timestamp INTEGER NOT NULL,
                    ingestion_status VARCHAR(20) DEFAULT 'PENDING',
                    payload_type VARCHAR(50) DEFAULT 'TELEMETRY',
                    measured_temperature REAL,
                    true_temperature REAL,
                    remaining_shelf_life REAL,
                    compressor_state TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_telemetry_pending 
                ON telemetry (ingestion_status, timestamp ASC);
            """)
            conn.commit()
    
    def insert_record(self, record: Dict[str, Any]):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
                INSERT INTO telemetry (
                    id, device_id, sequence_number, timestamp, 
                    payload_type, measured_temperature, true_temperature, remaining_shelf_life, 
                    compressor_state
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record["id"],
                record["device_id"],
                record["sequence_number"],
                record["timestamp"],
                record["payload_type"],
                record.get("measured_temperature"),
                record.get("true_temperature"),
                record.get("remaining_shelf_life"),
                record.get("compressor_state")
            ))
            conn.commit()

    def fetch_pending_batch(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM telemetry 
                WHERE ingestion_status = 'PENDING' 
                ORDER BY sequence_number ASC 
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_next_sequence_number(self, device_id: str) -> int:
        with self._lock, self._get_connection() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM telemetry WHERE device_id = ?",
                (device_id,),
            ).fetchone()
            return int(row[0])

    def delete_synced_batch(self, record_ids: List[str]):
        if not record_ids:
            return
        with self._lock, self._get_connection() as conn:
            conn.executemany(
                "DELETE FROM telemetry WHERE id = ?",
                [(rid,) for rid in record_ids]
            )
            conn.commit()
    
