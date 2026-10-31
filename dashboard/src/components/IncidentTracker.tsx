import React from 'react';
import type { Incident } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Thermometer,
  Timer,
} from 'lucide-react';

interface IncidentTrackerProps {
  incidents: Incident[];
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function formatTTR(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toUpperCase();
  if (s === 'CRITICAL') return <span className="badge badge-red"><ShieldAlert size={9} />{severity}</span>;
  if (s === 'HIGH') return <span className="badge badge-amber"><AlertTriangle size={9} />{severity}</span>;
  if (s === 'MEDIUM') return <span className="badge badge-blue">{severity}</span>;
  return <span className="badge badge-gray">{severity}</span>;
}

function IncidentTypeBadge({ type }: { type: string }) {
  if (type === 'HIGH_TEMPERATURE') {
    return (
      <span className="badge badge-red">
        <Thermometer size={9} />
        HIGH TEMP
      </span>
    );
  }
  if (type === 'HEARTBEAT_TIMEOUT') {
    return (
      <span className="badge badge-amber">
        <Wifi size={9} />
        HEARTBEAT TIMEOUT
      </span>
    );
  }
  return <span className="badge badge-gray">{type}</span>;
}

const DEVICE_HUE: Record<string, string> = {
  'cold-unit-01': '#60a5fa',
  'cold-unit-02': '#93c5fd',
  'cold-unit-03': '#38bdf8',
};

export const IncidentTracker: React.FC<IncidentTrackerProps> = ({ incidents }) => {
  const open = incidents.filter((i) => i.status === 'OPEN');

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
          <ShieldAlert size={15} style={{ color: '#ef4444' }} />
          <span className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
            Incidents & TTR
          </span>
          {open.length > 0 && (
            <span className="badge badge-red animate-pulse-red">{open.length} OPEN</span>
          )}
        </div>
        <span className="text-xs" style={{ color: '#687386' }}>Recent 25 events</span>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
        {incidents.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ height: 200, color: '#4a5a80' }}
          >
            <ShieldCheck size={32} style={{ opacity: 0.3 }} />
            <p className="text-sm">No incidents recorded</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {incidents.map((inc) => {
              const isOpen = inc.status === 'OPEN';
              const devColor = DEVICE_HUE[inc.device_id] || '#94a3b8';
              return (
                <div
                  key={inc.id}
                  className="rounded-lg p-3 animate-slide-in"
                  style={{
                    background: isOpen
                      ? 'rgba(239,68,68,0.06)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isOpen ? 'rgba(239,68,68,0.2)' : 'rgba(99,126,195,0.1)'}`,
                  }}
                >
                  {/* Row 1: type + severity + status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <IncidentTypeBadge type={inc.type} />
                      <SeverityBadge severity={inc.severity} />
                    </div>
                    {isOpen ? (
                      <span className="badge badge-red" style={{ flexShrink: 0 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#f87171',
                            display: 'inline-block',
                          }}
                          className="animate-pulse-red"
                        />
                        OPEN
                      </span>
                    ) : (
                      <span className="badge badge-green" style={{ flexShrink: 0 }}>
                        <CheckCircle2 size={9} />
                        RESOLVED
                      </span>
                    )}
                  </div>

                  {/* Row 2: device + detail */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: devColor,
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ color: devColor }}
                    >
                      {inc.device_id}
                    </span>
                    <span
                      className="text-xs truncate"
                      style={{ color: '#8b9dc3' }}
                      title={inc.detail}
                    >
                      {inc.detail}
                    </span>
                  </div>

                  {/* Row 3: timestamps + TTR */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Clock size={10} style={{ color: '#4a5a80' }} />
                      <span className="text-xs font-mono" style={{ color: '#4a5a80' }}>
                        {formatDate(inc.opened_at)}
                      </span>
                    </div>
                    {inc.ttr_seconds !== null && (
                      <div className="flex items-center gap-1">
                        <Timer size={10} style={{ color: '#34d399' }} />
                        <span className="text-xs font-mono font-bold" style={{ color: '#34d399' }}>
                          TTR: {formatTTR(inc.ttr_seconds)}{isOpen ? ' (running)' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
