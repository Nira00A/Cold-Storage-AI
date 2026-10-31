// Shared TypeScript types for the Cold Chain Dashboard

export type WsStatus = "LIVE" | "RECONNECTING" | "OFFLINE";

export type DeviceId = "all" | "cold-unit-01" | "cold-unit-02" | "cold-unit-03";

export interface TelemetryRecord {
  id: string;
  device_id: string;
  seq: number;
  timestamp: string;
  temperature: number | null;
  shelf_life: number | null;
  compressor: string;
  is_replayed: boolean;
}

export interface Incident {
  id: number;
  device_id: string;
  type: string;
  severity: string;
  detail: string;
  opened_at: string;
  resolved_at: string | null;
  ttr_seconds: number | null;
  status: string;
}

export interface DeviceAudit {
  device_id: string;
  min_seq: number;
  max_seq: number;
  expected: number;
  received: number;
  missing: number;
  completeness_pct: number;
}

export interface DashboardState {
  telemetry: TelemetryRecord[];
  incidents: Incident[];
  audits: DeviceAudit[];
}

export interface WsMessage {
  type: "TELEMETRY_UPDATE";
  inserted: number;
  duplicates: number;
  sample: TelemetryRecord;
  samples?: TelemetryRecord[];
}

export interface AIDiagnostic {
  health: "NOMINAL" | "DEGRADED" | "CRITICAL" | "NO_DATA" | "ERROR";
  root_cause: string;
  action_item: string;
  summary: string;
  insights: string[];
  average_sla: number;
  average_ttr_seconds: number;
  temperature_spike_count: number;
  spike_devices: string[];
}
