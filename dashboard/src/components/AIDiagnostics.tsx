import React, { useState, useEffect, useCallback } from 'react';
import type { DeviceId, AIDiagnostic } from '../types';
import {
  BrainCircuit,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Search,
  ChevronRight,
  Bot,
  Activity,
  Thermometer,
  Timer,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '');


interface AIDiagnosticsProps {
  selectedDevice: DeviceId;
}

function HealthBadge({ health }: { health: AIDiagnostic['health'] }) {
  if (health === 'NOMINAL')
    return (
      <span
        className="badge badge-green"
        style={{ fontSize: '0.8rem', padding: '4px 12px' }}
      >
        <ShieldCheck size={13} />
        NOMINAL
      </span>
    );
  if (health === 'DEGRADED')
    return (
      <span
        className="badge badge-amber"
        style={{ fontSize: '0.8rem', padding: '4px 12px' }}
      >
        <AlertTriangle size={13} />
        DEGRADED
      </span>
    );
  if (health === 'NO_DATA')
    return (
      <span
        className="badge badge-gray"
        style={{ fontSize: '0.8rem', padding: '4px 12px' }}
      >
        NO DATA
      </span>
    );
  return (
    <span
      className="badge badge-red"
      style={{ fontSize: '0.8rem', padding: '4px 12px' }}
    >
      <ShieldAlert size={13} />
      CRITICAL
    </span>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.12)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} style={{ color: iconColor, flexShrink: 0 }} />
        <span
          className="text-xs font-bold tracking-wide uppercase"
          style={{ color: '#687386' }}
        >
          {label}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: '#e2e8f0' }}>
        {value}
      </p>
    </div>
  );
}

const HEALTH_BG: Record<AIDiagnostic['health'], string> = {
  NOMINAL: 'rgba(16,185,129,0.06)',
  DEGRADED: 'rgba(245,158,11,0.06)',
  CRITICAL: 'rgba(239,68,68,0.08)',
  NO_DATA: 'rgba(100,116,139,0.08)',
  ERROR: 'rgba(239,68,68,0.08)',
};
const HEALTH_BORDER: Record<AIDiagnostic['health'], string> = {
  NOMINAL: 'rgba(16,185,129,0.2)',
  DEGRADED: 'rgba(245,158,11,0.2)',
  CRITICAL: 'rgba(239,68,68,0.25)',
  NO_DATA: 'rgba(100,116,139,0.25)',
  ERROR: 'rgba(239,68,68,0.25)',
};

export const AIDiagnostics: React.FC<AIDiagnosticsProps> = ({ selectedDevice }) => {
  const [diagnostic, setDiagnostic] = useState<AIDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDevice, setLastDevice] = useState<string | null>(null);

  const targetDevice =
    selectedDevice === 'all' ? 'cold-unit-01' : selectedDevice;

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDiagnostic(null);
    setLastDevice(targetDevice);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/ai/analyze/${targetDevice}`
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server returned ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setDiagnostic({
        health: data.health ?? 'ERROR',
        root_cause: data.root_cause ?? 'No root cause returned.',
        action_item: data.action_item ?? 'Review backend diagnostics.',
        summary: data.summary ?? 'No summary returned.',
        insights: Array.isArray(data.insights) ? data.insights : [],
        average_sla: Number(data.average_sla ?? 0),
        average_ttr_seconds: Number(data.average_ttr_seconds ?? 0),
        temperature_spike_count: Number(data.temperature_spike_count ?? 0),
        spike_devices: Array.isArray(data.spike_devices) ? data.spike_devices : [],
      });
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [targetDevice]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  return (
    <div
      className="glass-card flex flex-col"
      style={{ height: '100%', minHeight: 0 }}
    >
      {/* Panel Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(99,126,195,0.12)' }}
      >
        <div className="flex items-center gap-2">
          <BrainCircuit size={15} style={{ color: '#60a5fa' }} />
          <span className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
            AI Operational Diagnostician
          </span>
        </div>
        <span className="badge badge-blue">Gemini</span>
      </div>

      {/* Content */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Target device indicator */}
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <Bot size={13} style={{ color: '#93c5fd' }} />
            <span className="text-xs" style={{ color: '#b8c2d1' }}>Target Device:</span>
            <span className="font-mono text-xs font-bold" style={{ color: '#bfdbfe' }}>
              {targetDevice}
            </span>
          </div>
          {selectedDevice === 'all' && (
            <span className="text-xs" style={{ color: '#687386' }}>
              (Select a device for targeted analysis)
            </span>
          )}
        </div>

        {diagnostic && !loading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.12)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Activity size={12} style={{ color: '#60a5fa' }} />
                <span className="text-xs uppercase" style={{ color: '#687386' }}>Avg SLA</span>
              </div>
              <strong className="font-mono text-sm" style={{ color: '#f8fafc' }}>{diagnostic.average_sla.toFixed(2)}%</strong>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.12)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Timer size={12} style={{ color: '#60a5fa' }} />
                <span className="text-xs uppercase" style={{ color: '#687386' }}>Avg TTR</span>
              </div>
              <strong className="font-mono text-sm" style={{ color: '#f8fafc' }}>{diagnostic.average_ttr_seconds.toFixed(1)}s</strong>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.12)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Thermometer size={12} style={{ color: '#60a5fa' }} />
                <span className="text-xs uppercase" style={{ color: '#687386' }}>Spikes</span>
              </div>
              <strong className="font-mono text-sm" style={{ color: diagnostic.temperature_spike_count > 0 ? '#f8fafc' : '#94a3b8' }}>
                {diagnostic.temperature_spike_count}
              </strong>
            </div>
          </div>
        )}

        {/* Run button */}
        <button
          id="run-ai-diagnostics-btn"
          className="btn-primary w-full justify-center"
          onClick={runDiagnostics}
          disabled={loading}
          style={{ fontSize: '0.85rem' }}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin-slow" />
              Running AI Analysis…
            </>
          ) : (
            <>
              <Search size={15} />
              Run AI Diagnostics
            </>
          )}
        </button>

        {/* Error state */}
        {error && (
          <div
            className="rounded-lg p-3 text-sm animate-slide-in"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171',
            }}
          >
            <div className="flex items-center gap-2 mb-1 font-semibold">
              <AlertTriangle size={13} />
              Analysis Failed
            </div>
            <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-3 animate-slide-in">
            {[120, 80, 100, 160].map((w, i) => (
              <div
                key={i}
                className="rounded-lg"
                style={{
                  height: 16,
                  width: `${w}px`,
                  background: 'rgba(255,255,255,0.06)',
                  animation: `pulse-amber 1.5s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* Diagnostic result */}
        {diagnostic && !loading && (
          <div
            className="rounded-xl p-4 flex flex-col gap-3 animate-slide-in"
            style={{
              background: HEALTH_BG[diagnostic.health],
              border: `1px solid ${HEALTH_BORDER[diagnostic.health]}`,
            }}
          >
            {/* Health badge + device */}
            <div className="flex items-center justify-between">
              <HealthBadge health={diagnostic.health} />
              <span className="font-mono text-xs" style={{ color: '#687386' }}>
                {lastDevice}
              </span>
            </div>

            <div
              style={{ height: 1, background: 'rgba(148,163,184,0.16)' }}
            />

            <InfoBlock
              icon={Search}
              label="Root Cause"
              value={diagnostic.root_cause}
              iconColor="#f59e0b"
            />
            <InfoBlock
              icon={Zap}
              label="Action Item"
              value={diagnostic.action_item}
              iconColor="#3b82f6"
            />
            <InfoBlock
              icon={ChevronRight}
              label="Detailed Summary"
              value={diagnostic.summary}
              iconColor="#60a5fa"
            />
            {diagnostic.insights.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.16)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={13} style={{ color: '#60a5fa' }} />
                  <span className="text-xs font-bold tracking-wide uppercase" style={{ color: '#93c5fd' }}>
                    Operational Insights
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5 m-0 pl-4">
                  {diagnostic.insights.map((insight) => (
                    <li key={insight} className="text-xs" style={{ color: '#dbeafe' }}>{insight}</li>
                  ))}
                </ul>
                <p className="text-xs mt-2" style={{ color: '#687386' }}>
                  Spike devices: {diagnostic.spike_devices.join(', ') || 'none'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!diagnostic && !loading && !error && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl p-8"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(96,165,250,0.25)',
            }}
          >
            <BrainCircuit size={36} style={{ color: '#60a5fa', opacity: 0.45 }} />
            <p className="text-sm text-center" style={{ color: '#687386' }}>
              Click <strong style={{ color: '#bfdbfe' }}>Run AI Diagnostics</strong> to
              analyze device health via Gemini AI
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
