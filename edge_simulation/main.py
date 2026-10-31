import signal
import sys
import threading
import time
from .config import config
from .database.database import LocalDatabase
from .devices.devices import EdgeDevice
from .sync_worker import BackendSyncWorker

def main():
    print("[Gateway] Initializing SQLite outbox database...")
    db = LocalDatabase(config.DB_PATH)

    print(f"[Gateway] Preparing sync worker for {config.BACKEND_URL}...")
    sync_worker = BackendSyncWorker(db)
    sync_thread = threading.Thread(target=sync_worker.start, daemon=True, name="SyncWorker")

    print(f"[Gateway] Initializing {len(config.DEVICE_IDS)} simulated devices...")
    devices = [EdgeDevice(device_id=dev_id, db=db) for dev_id in config.DEVICE_IDS]
    device_threads = [
        threading.Thread(target=dev.run, daemon=True, name=f"Device-{dev.device_id}")
        for dev in devices
    ]

    def shutdown_handler(signum, frame):
        print("\n[Gateway] Shutdown requested. Stopping threads...")
        for dev in devices:
            dev.stop()
        sync_worker.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # Start all threads
    sync_thread.start()
    for t in device_threads:
        t.start()

    print("[Gateway] Edge engine is running. Press Ctrl+C to terminate.")
    
    # Keep main thread alive
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()