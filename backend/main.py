import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from .database import init_postgres, get_db
from .models import IngestBatchRequest
from .recovery import ReplayAndRecoveryEngine
from .incident_engine import IncidentEngine
from .ai_analyst import ColdStorageAIAnalyst

app = FastAPI(title="Industrial Cold-Chain Core Ingestion & Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket Broadcast Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()


def dashboard_telemetry_record(record):
    return {
        "id": record.id,
        "device_id": record.device_id,
        "seq": record.sequence_number,
        "timestamp": record.timestamp.isoformat(),
        "temperature": record.measured_temperature,
        "shelf_life": record.remaining_shelf_life,
        "compressor": record.compressor_state,
        "is_replayed": False,
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.on_event("startup")
async def startup_event():
    init_postgres()
    # Background task for heartbeat watchdog
    asyncio.create_task(heartbeat_watchdog_loop())

async def heartbeat_watchdog_loop():
    while True:
        try:
            IncidentEngine.evaluate_heartbeats()
        except Exception as e:
            print(f"[Watchdog Error] {e}")
        await asyncio.sleep(5)

# --- REST Endpoints ---

@app.post("/api/v1/telemetry/ingest")
async def ingest_telemetry(batch: IngestBatchRequest, background_tasks: BackgroundTasks):
    # 1. Recovery & Replay Ingestion to PostgreSQL
    inserted, duplicates = ReplayAndRecoveryEngine.ingest_and_reconcile(batch.records)

    # 2. Incident & TTR Evaluation in background
    background_tasks.add_task(IncidentEngine.process_telemetry_batch, batch.records)

    # 3. Broadcast to React Dashboard via WebSocket
    if batch.records:
        samples = [dashboard_telemetry_record(record) for record in batch.records]
        background_tasks.add_task(manager.broadcast, {
            "type": "TELEMETRY_UPDATE",
            "inserted": inserted,
            "duplicates": duplicates,
            "sample": samples[-1],
            "samples": samples,
        })

    return {
        "status": "PROCESSED",
        "inserted": inserted,
        "duplicates_rejected": duplicates
    }

@app.get("/api/v1/dashboard/state")
def get_dashboard_state():
    """Returns the consolidated state for the React Dashboard."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Recent Telemetry
            cur.execute("""
                SELECT id, device_id, sequence_number, timestamp, measured_temperature, 
                       remaining_shelf_life, compressor_state, is_replayed
                FROM telemetry_logs 
                ORDER BY timestamp DESC LIMIT 25;
            """)
            telemetry = [
                {
                    "id": str(r[0]), "device_id": r[1], "seq": r[2], "timestamp": str(r[3]),
                    "temperature": float(r[4]) if r[4] is not None else None,
                    "shelf_life": float(r[5]) if r[5] is not None else None,
                    "compressor": r[6], "is_replayed": r[7]
                }
                for r in cur.fetchall()
            ]

            # Active & Recent Incidents
            cur.execute("""
                  SELECT id, device_id, incident_type, severity, detail, opened_at, resolved_at,
                      COALESCE(ttr_seconds, EXTRACT(EPOCH FROM (NOW() - opened_at))), status
                FROM incidents 
                  ORDER BY opened_at DESC LIMIT 25;
            """)
            incidents = [
                {
                    "id": r[0], "device_id": r[1], "type": r[2], "severity": r[3],
                    "detail": r[4], "opened_at": str(r[5]), "resolved_at": str(r[6]) if r[6] else None,
                    "ttr_seconds": float(r[7]) if r[7] is not None else None, "status": r[8]
                }
                for r in cur.fetchall()
            ]

    # Completeness audit per device
    audit = [
        ReplayAndRecoveryEngine.audit_device_completeness(d)
        for d in ["cold-unit-01", "cold-unit-02", "cold-unit-03"]
    ]

    return {
        "telemetry": telemetry,
        "incidents": incidents,
        "audits": audit
    }

@app.get("/api/v1/ai/analyze/{device_id}")
def analyze_device(device_id: str):
    return ColdStorageAIAnalyst.analyze_device_status(device_id)

@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)