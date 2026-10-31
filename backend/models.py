from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class TelemetryPayload(BaseModel):
    id: str
    device_id: str
    sequence_number: int
    timestamp: datetime
    payload_type: str
    measured_temperature: Optional[float] = None
    true_temperature: Optional[float] = None
    remaining_shelf_life: Optional[float] = None
    compressor_state: Optional[str] = "OFF"

class IngestBatchRequest(BaseModel):
    records: List[TelemetryPayload]
    
class IncidentResponse(BaseModel):
    id: int
    device_id: str
    incident_type: str
    severity: str
    detail: str
    opened_at: datetime
    resolved_at: Optional[datetime]
    ttr_seconds: Optional[float]
    status: str

class SLAMetricsResponse(BaseModel):
    device_id: str
    completeness_pct: float
    total_received: int
    missing_packets: int
    avg_ttr_seconds: float