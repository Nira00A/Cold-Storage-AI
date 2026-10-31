from datetime import datetime, timezone
from .database import get_db
from .config import settings

class IncidentEngine:
    @staticmethod
    def process_telemetry_batch(records):
        """Scans ingested readings to open or resolve temperature breach incidents."""
        now = datetime.now(timezone.utc)

        with get_db() as conn:
            with conn.cursor() as cur:
                for r in records:
                    if r.measured_temperature is None:
                        continue

                    # 1. Breach Detection (Temp > CRITICAL)
                    if r.measured_temperature > settings.TEMP_THRESHOLD_CRITICAL:
                        # Check if an incident is already open
                        cur.execute("""
                            SELECT id FROM incidents 
                            WHERE device_id = %s AND incident_type = 'HIGH_TEMPERATURE' AND status = 'OPEN';
                        """, (r.device_id,))
                        if not cur.fetchone():
                            cur.execute("""
                                INSERT INTO incidents (device_id, incident_type, severity, detail, opened_at, status)
                                VALUES (%s, 'HIGH_TEMPERATURE', 'CRITICAL', %s, %s, 'OPEN');
                            """, (
                                r.device_id,
                                f"Temp spike: {r.measured_temperature}°C (Limit: {settings.TEMP_THRESHOLD_CRITICAL}°C)",
                                r.timestamp
                            ))

                    # 2. Recovery Detection (Temp <= NORMAL) -> Close & Calculate TTR
                    elif r.measured_temperature <= settings.TEMP_THRESHOLD_NORMAL:
                        cur.execute("""
                            SELECT id, opened_at FROM incidents 
                            WHERE device_id = %s AND incident_type = 'HIGH_TEMPERATURE' AND status = 'OPEN';
                        """, (r.device_id,))
                        open_inc = cur.fetchone()
                        if open_inc:
                            inc_id, opened_at = open_inc[0], open_inc[1]
                            ttr_sec = (r.timestamp - opened_at).total_seconds()
                            cur.execute("""
                                UPDATE incidents 
                                SET status = 'RESOLVED', resolved_at = %s, ttr_seconds = %s
                                WHERE id = %s;
                            """, (r.timestamp, max(0.0, ttr_sec), inc_id))
            conn.commit()

    @staticmethod
    def evaluate_heartbeats():
        """Watchdog: verifies if any device has stopped emitting within timeout window."""
        now = datetime.now(timezone.utc)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT device_id, MAX(timestamp) 
                    FROM telemetry_logs 
                    WHERE payload_type = 'HEARTBEAT'
                    GROUP BY device_id;
                """)
                devices = cur.fetchall()

                for dev_id, last_seen in devices:
                    elapsed = (now - last_seen).total_seconds()

                    if elapsed > settings.HEARTBEAT_TIMEOUT_SEC:
                        cur.execute("""
                            SELECT id FROM incidents 
                            WHERE device_id = %s AND incident_type = 'HEARTBEAT_TIMEOUT' AND status = 'OPEN';
                        """, (dev_id,))
                        if not cur.fetchone():
                            cur.execute("""
                                INSERT INTO incidents (device_id, incident_type, severity, detail, opened_at, status)
                                VALUES (%s, 'HEARTBEAT_TIMEOUT', 'CRITICAL', %s, %s, 'OPEN');
                            """, (dev_id, f"Device silent for {int(elapsed)}s", now))
                    else:
                        # Auto-resolve heartbeat incident if communication resumed
                        cur.execute("""
                            SELECT id, opened_at FROM incidents 
                            WHERE device_id = %s AND incident_type = 'HEARTBEAT_TIMEOUT' AND status = 'OPEN';
                        """, (dev_id,))
                        open_hb = cur.fetchone()
                        if open_hb:
                            ttr = (now - open_hb[1]).total_seconds()
                            cur.execute("""
                                UPDATE incidents 
                                SET status = 'RESOLVED', resolved_at = %s, ttr_seconds = %s
                                WHERE id = %s;
                            """, (now, ttr, open_hb[0]))
            conn.commit()