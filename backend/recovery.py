from typing import List, Dict, Any, Tuple
from .database import get_db
from .models import TelemetryPayload

class ReplayAndRecoveryEngine:
    @staticmethod
    def ingest_and_reconcile(records: List[TelemetryPayload]) -> Tuple[int, int]:
        """
        Inserts incoming batch idempotently and marks backfilled data.
        Returns: (inserted_count, duplicate_count)
        """
        if not records:
            return (0, 0)

        # Sort batch by sequence_number to preserve arrival order
        sorted_records = sorted(records, key=lambda x: (x.device_id, x.sequence_number))

        insert_query = """
            INSERT INTO telemetry_logs (
                id, device_id, sequence_number, timestamp, payload_type,
                measured_temperature, true_temperature, remaining_shelf_life,
                compressor_state, is_replayed
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (device_id, sequence_number) DO NOTHING;
        """

        inserted_count = 0
        with get_db() as conn:
            with conn.cursor() as cur:
                for r in sorted_records:
                    # Check if there is already a higher sequence recorded for this device
                    cur.execute(
                        "SELECT MAX(sequence_number) FROM telemetry_logs WHERE device_id = %s;",
                        (r.device_id,)
                    )
                    max_seq = cur.fetchone()[0] or 0
                    is_replay = r.sequence_number < max_seq

                    cur.execute(insert_query, (
                        r.id, r.device_id, r.sequence_number, r.timestamp,
                        r.payload_type, r.measured_temperature, r.true_temperature,
                        r.remaining_shelf_life, r.compressor_state, is_replay
                    ))
                    inserted_count += cur.rowcount
            conn.commit()

        duplicates = len(records) - inserted_count
        return inserted_count, duplicates

    @staticmethod
    def audit_device_completeness(device_id: str) -> Dict[str, Any]:
        """Calculates sequence completeness and packet loss for an individual device."""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        MIN(sequence_number) as min_s, 
                        MAX(sequence_number) as max_s, 
                        COUNT(DISTINCT sequence_number) as actual_count
                    FROM telemetry_logs 
                    WHERE device_id = %s;
                """, (device_id,))
                row = cur.fetchone()

                min_s, max_s, actual = row[0] or 0, row[1] or 0, row[2] or 0
                expected = (max_s - min_s + 1) if max_s >= min_s and actual > 0 else 0
                missing = max(0, expected - actual)
                completeness = round((actual / expected * 100), 2) if expected > 0 else 100.0

                return {
                    "device_id": device_id,
                    "min_seq": min_s,
                    "max_seq": max_s,
                    "expected": expected,
                    "received": actual,
                    "missing": missing,
                    "completeness_pct": completeness
                }