import time
import requests
from .config import config
from .database.database import LocalDatabase

class BackendSyncWorker:
    """Flushes buffered records to the main backend with retry handling."""

    def __init__(self, db: LocalDatabase):
        self.db = db
        self.endpoint = f"{config.BACKEND_URL.rstrip('/')}/api/v1/telemetry/ingest"
        self.running = False

    def start(self):
        self.running = True
        backoff_delay = 1.0

        while self.running:
            batch = self.db.fetch_pending_batch(limit=config.SYNC_BATCH_SIZE)
            if not batch:
                time.sleep(config.SYNC_INTERVAL_SEC)
                continue

            payload = [
                {
                    "id": r["id"],
                    "device_id": r["device_id"],
                    "sequence_number": r["sequence_number"],
                    "timestamp": r["timestamp"],
                    "payload_type": r["payload_type"],
                    "measured_temperature": r["measured_temperature"],
                    "true_temperature": r["true_temperature"],
                    "remaining_shelf_life": r["remaining_shelf_life"],
                    "compressor_state": r["compressor_state"]
                }
                for r in batch
            ]

            try:
                response = requests.post(
                    self.endpoint, 
                    json={"records": payload}, 
                    timeout=5.0
                )

                if response.status_code in [200, 201]:
                    # Batch delivered: purge synced items from the edge outbox
                    ids = [r["id"] for r in batch]
                    self.db.delete_synced_batch(ids)
                    backoff_delay = 1.0  # Reset backoff on success
                    print(f"[SyncWorker] Synced {len(payload)} records to backend.")
                else:
                    print(f"[SyncWorker] Backend rejection: {response.status_code} - {response.text}")
                    time.sleep(min(backoff_delay, 15.0))
                    backoff_delay *= 2.0

            except requests.exceptions.RequestException:
                # Network disconnected: preserve data in SQLite outbox and back off
                print(f"[SyncWorker] Network error: no connection to backend.")
                time.sleep(min(backoff_delay, 60.0))
                backoff_delay *= 2.0

    def stop(self):
        self.running = False