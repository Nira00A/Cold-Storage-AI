import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';

import type { DashboardState, TelemetryRecord, WsMessage, DeviceId } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { Header } from './components/Header';
import { SLACards } from './components/SLACards';
import { TelemetryFeed } from './components/TelemetryFeed';
import { IncidentTracker } from './components/IncidentTracker';
import { AIDiagnostics } from './components/AIDiagnostics';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '');
const MAX_TELEMETRY_ROWS = 25;
const STATE_REFRESH_INTERVAL_MS = 3000;

function normalizeTelemetryRecord(value: unknown): TelemetryRecord | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : null;
  const deviceId = typeof raw.device_id === 'string' ? raw.device_id : null;
  const seq = raw.seq ?? raw.sequence_number;
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : null;

  if (!id || !deviceId || typeof seq !== 'number' || !timestamp) return null;

  const temperature = raw.temperature ?? raw.measured_temperature;
  const shelfLife = raw.shelf_life ?? raw.remaining_shelf_life;
  const compressor = raw.compressor ?? raw.compressor_state;

  return {
    id,
    device_id: deviceId,
    seq,
    timestamp,
    temperature: typeof temperature === 'number' ? temperature : null,
    shelf_life: typeof shelfLife === 'number' ? shelfLife : null,
    compressor: typeof compressor === 'string' ? compressor : 'OFF',
    is_replayed: raw.is_replayed === true,
  };
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--color-bg-base)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 24px rgba(96,165,250,0.35)',
        }}
      >
        <Loader2 size={28} className="animate-spin-slow" style={{ color: 'white' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p
          className="text-sm font-semibold tracking-widest"
          style={{ color: '#b8c2d1', textTransform: 'uppercase', letterSpacing: '0.2em' }}
        >
          Initializing Dashboard
        </p>
        <p className="text-xs mt-1" style={{ color: '#687386' }}>
          Fetching state from backend…
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--color-bg-base)',
      }}
    >
      <AlertCircle size={40} style={{ color: '#60a5fa' }} />
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <p className="font-bold mb-1" style={{ color: '#f8fafc' }}>Failed to connect to backend</p>
        <p className="text-sm" style={{ color: '#b8c2d1' }}>{message}</p>
        <p className="text-xs mt-2" style={{ color: '#687386' }}>
          Make sure the FastAPI server is running on{' '}
          <code className="font-mono" style={{ color: '#93c5fd' }}>localhost:8000</code>
        </p>
      </div>
      <button className="btn-primary" onClick={onRetry}>
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>('all');

  // -------------------------------------------------------------------
  // Initial state fetch
  // -------------------------------------------------------------------
  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dashboard/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data: DashboardState = await res.json();
      setState(data);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // -------------------------------------------------------------------
  // WebSocket handler — prepend new sample row
  // -------------------------------------------------------------------
  const handleWsMessage = useCallback((msg: WsMessage) => {
    if (msg.type !== 'TELEMETRY_UPDATE' || !msg.sample) return;
    const samples = (msg.samples ?? [msg.sample])
      .map(normalizeTelemetryRecord)
      .filter((sample): sample is TelemetryRecord => sample !== null);
    if (samples.length === 0) return;

    setState((prev) => {
      if (!prev) return prev;

      const existingIds = new Set(prev.telemetry.map((record) => record.id));
      const newSamples = samples.filter((sample) => !existingIds.has(sample.id));
      if (newSamples.length === 0) return prev;

      const newFeed = [...newSamples, ...prev.telemetry]
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, MAX_TELEMETRY_ROWS);
      return { ...prev, telemetry: newFeed };
    });
  }, []);

  const { status: wsStatus, liveStats } = useWebSocket(handleWsMessage);

  // -------------------------------------------------------------------
  // Periodic audit refresh (every 15 s)
  // -------------------------------------------------------------------
  const auditTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const refreshAudits = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/dashboard/state`);
        if (!res.ok) return;
        const data: DashboardState = await res.json();
        setState((prev) =>
          prev
            ? { ...prev, audits: data.audits, incidents: data.incidents }
            : data
        );
      } catch {
        // silent — WS indicator shows connectivity status
      }
    };
    auditTimer.current = setInterval(refreshAudits, STATE_REFRESH_INTERVAL_MS);
    return () => {
      if (auditTimer.current) clearInterval(auditTimer.current);
    };
  }, []);

  // -------------------------------------------------------------------
  // Filtered telemetry by device
  // -------------------------------------------------------------------
  const filteredTelemetry = state
    ? selectedDevice === 'all'
      ? state.telemetry
      : state.telemetry.filter((r) => r.device_id === selectedDevice)
    : [];

  const filteredIncidents = state
    ? selectedDevice === 'all'
      ? state.incidents
      : state.incidents.filter((i) => i.device_id === selectedDevice)
    : [];

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} onRetry={fetchState} />;
  if (!state) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <Header
        wsStatus={wsStatus}
        selectedDevice={selectedDevice}
        onDeviceChange={setSelectedDevice}
        liveStats={liveStats}
      />

      {/* ── SLA Stat Cards ── */}
      <SLACards audits={state.audits} />

      {/* ── Main 3-Column Grid ── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          padding: '16px 24px 24px',
          minHeight: 0,
          height: 'calc(100vh - 56px - 180px)',
        }}
      >
        <TelemetryFeed records={filteredTelemetry} />
        <IncidentTracker incidents={filteredIncidents} />
        <AIDiagnostics selectedDevice={selectedDevice} />
      </div>
    </div>
  );
}
