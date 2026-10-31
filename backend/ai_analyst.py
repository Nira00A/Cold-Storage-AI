import json
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from .config import settings
from .database import get_db


# --- Structured Output Schema ---
class AnalysisReport(BaseModel):
    health: str = Field(
        description="Current status: NOMINAL, DEGRADED, or CRITICAL"
    )
    root_cause: str = Field(
        description="Hypothesized root cause (e.g. compressor failure, door seal leak, sensor drop)"
    )
    action_item: str = Field(
        description="Immediate corrective action recommended for the floor technician"
    )
    summary: str = Field(
        description="2-3 sentence overview explaining the telemetry trends and recovery rate"
    )
    insights: list[str] = Field(
        description="Three concise operational insights grounded in the metrics"
    )
    average_sla: float = Field(description="Average telemetry completeness percentage across devices")
    average_ttr_seconds: float = Field(description="Average resolved incident TTR in seconds")
    temperature_spike_count: int = Field(description="Temperature readings above the critical threshold")
    spike_devices: list[str] = Field(description="Devices with recent temperature spikes")


class ColdStorageAIAnalyst:
    @staticmethod
    def _fetch_context(device_id: str):
        """Fetches device context plus fleet-level operational metrics."""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT sequence_number, timestamp, measured_temperature, 
                           remaining_shelf_life, compressor_state, is_replayed
                    FROM telemetry_logs 
                    WHERE device_id = %s 
                    ORDER BY sequence_number DESC LIMIT 15;
                """, (device_id,))
                logs = cur.fetchall()

                cur.execute("""
                    SELECT incident_type, severity, detail, status, opened_at, ttr_seconds 
                    FROM incidents 
                    WHERE device_id = %s
                    ORDER BY opened_at DESC LIMIT 10;
                """, (device_id,))
                incidents = cur.fetchall()

                cur.execute("""
                    SELECT
                        COALESCE(AVG(
                            CASE
                                WHEN max_seq >= min_seq AND actual_count > 0
                                THEN actual_count::numeric / (max_seq - min_seq + 1) * 100
                                ELSE 100
                            END
                        ), 100),
                        (SELECT COALESCE(AVG(ttr_seconds), 0)
                         FROM incidents
                         WHERE status = 'RESOLVED' AND ttr_seconds IS NOT NULL),
                        (SELECT COUNT(*)
                         FROM telemetry_logs
                         WHERE measured_temperature > %s
                           AND timestamp >= NOW() - INTERVAL '30 minutes')
                    FROM (
                        SELECT device_id, MIN(sequence_number) AS min_seq,
                               MAX(sequence_number) AS max_seq,
                               COUNT(DISTINCT sequence_number) AS actual_count
                        FROM telemetry_logs
                        GROUP BY device_id
                    ) device_stats;
                """, (settings.TEMP_THRESHOLD_CRITICAL,))
                metric_row = cur.fetchone()

                cur.execute("""
                    SELECT DISTINCT device_id
                    FROM telemetry_logs
                    WHERE measured_temperature > %s
                      AND timestamp >= NOW() - INTERVAL '30 minutes'
                    ORDER BY device_id;
                """, (settings.TEMP_THRESHOLD_CRITICAL,))
                spike_devices = [row[0] for row in cur.fetchall()]

        average_sla, average_ttr, spike_count = metric_row or (100.0, 0.0, 0)
        return logs, incidents, {
            "average_sla": float(average_sla or 100.0),
            "average_ttr_seconds": float(average_ttr or 0.0),
            "temperature_spike_count": int(spike_count or 0),
            "spike_devices": spike_devices,
        }

    @classmethod
    def analyze_device_status(cls, device_id: str) -> dict:
        logs, incidents, metrics = cls._fetch_context(device_id)

        if not logs:
            return cls._heuristic_report(device_id, logs, incidents, metrics)

        if not settings.GEMINI_API_KEY.strip():
            return cls._heuristic_report(device_id, logs, incidents, metrics)

        try:
            # Initialize Gemini via LangChain
            llm = ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL.strip() or "gemini-2.5-flash",
                google_api_key=settings.GEMINI_API_KEY,
                temperature=0.1
            )

            prompt = ChatPromptTemplate.from_messages([
                (
                    "system",
                    "You are an expert industrial IoT and cold-storage operations diagnostician. "
                    "Analyze device telemetry and fleet metrics. Return practical, evidence-based insights."
                ),
                (
                    "human",
                    "Unit ID: {device_id}\n\n"
                    "Recent Telemetry (Seq, Timestamp, Temp, RemainingShelfLife%, Compressor, Replayed):\n{telemetry}\n\n"
                    "Recent Incidents (Type, Severity, Detail, Status, OpenedAt, TTR_Seconds):\n{incidents}\n\n"
                    "Fleet Metrics (Average SLA %, Average Resolved TTR Seconds, Temperature Spikes in 30 Minutes, Devices With Spikes):\n{metrics}"
                )
            ])

            chain = prompt | llm.with_structured_output(AnalysisReport)
            report: AnalysisReport = chain.invoke({
                "device_id": device_id,
                "telemetry": json.dumps(logs, default=str),
                "incidents": json.dumps(incidents, default=str),
                "metrics": json.dumps(metrics, default=str),
            })
            return report.model_dump()
        except Exception:
            return cls._heuristic_report(device_id, logs, incidents, metrics)

    @staticmethod
    def _heuristic_report(device_id: str, logs: list, incidents: list, metrics: dict) -> dict:
        if not logs:
            return {
                "health": "NO_DATA",
                "root_cause": "No telemetry available",
                "action_item": "Verify the edge gateway and device connection.",
                "summary": f"No telemetry recorded for {device_id}.",
                "insights": ["Waiting for telemetry before assessing device health."],
                **metrics,
            }

        latest_temp = float(logs[0][2]) if logs[0][2] is not None else None
        open_incidents = [incident for incident in incidents if incident[3] == "OPEN"]
        is_critical = bool(open_incidents) or (
            latest_temp is not None and latest_temp > settings.TEMP_THRESHOLD_CRITICAL
        )
        latest_ttr = next((incident[5] for incident in incidents if incident[5] is not None), None)
        ttr_text = f" Latest TTR: {float(latest_ttr):.1f}s." if latest_ttr is not None else ""
        spike_text = ", ".join(metrics["spike_devices"]) or "none"
        return {
            "health": "CRITICAL" if is_critical else "NOMINAL",
            "root_cause": "Open incident or threshold breach detected" if is_critical else "Normal operations",
            "action_item": "Inspect refrigeration and acknowledge the active incident." if is_critical else "No action required.",
            "summary": f"Deterministic analysis: latest reading is {latest_temp}°C with {len(incidents)} recorded incidents.{ttr_text}",
            "insights": [
                f"Average fleet SLA is {metrics['average_sla']:.2f}%.",
                f"Average resolved TTR is {metrics['average_ttr_seconds']:.1f}s.",
                f"{metrics['temperature_spike_count']} recent temperature spikes across: {spike_text}.",
            ],
            **metrics,
        }