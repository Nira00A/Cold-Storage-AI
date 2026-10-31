import React, { useEffect, useRef } from 'react';
import type { TelemetryRecord } from '../types';
import { AlertTriangle, RefreshCw, Power, Activity } from 'lucide-react';

interface TelemetryFeedProps {
  records: TelemetryRecord[];
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function TempCell({ temp }: { temp: number | null }) {
  if (temp === null) return <span style={{ color: '#4a5a80' }}>—</span>;
  const isHot = temp > 8.0;
  return (
    <span
      style={{
        color: isHot ? '#f87171' : '#34d399',
        fontWeight: isHot ? 700 : 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {isHot && <AlertTriangle size={11} style={{ color: '#f87171', flexShrink: 0 }} />}
      {temp.toFixed(2)}°C
    </span>
  );
}

const DEVICE_HUE: Record<string, string> = {
  'cold-unit-01': '#60a5fa',
  'cold-unit-02': '#93c5fd',
  'cold-unit-03': '#38bdf8',
};

export const TelemetryFeed: React.FC<TelemetryFeedProps> = ({ records }) => {
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  // Flash newest row
  useEffect(() => {
    if (!tbodyRef.current) return;
    const firstRow = tbodyRef.current.querySelector('tr');
    if (!firstRow) return;
    firstRow.style.transition = 'none';
    firstRow.style.background = 'rgba(59,130,246,0.12)';
    requestAnimationFrame(() => {
      firstRow.style.transition = 'background 0.8s ease';
      firstRow.style.background = '';
    });
  }, [records[0]?.id]);

  return (
    <div className="glass-card flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(99,126,195,0.12)' }}
      >
        <div className="flex items-center gap-2">
          <Activity size={15} style={{ color: '#60a5fa' }} />
          <span className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
            Live Telemetry Feed
          </span>
          <span className="badge badge-blue ml-1">{records.length}</span>
        </div>
        <span className="text-xs" style={{ color: '#687386' }}>Latest 25 packets</span>
      </div>

      {/* Table */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {records.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ height: 200, color: '#4a5a80' }}
          >
            <Activity size={32} style={{ opacity: 0.3 }} />
            <p className="text-sm">Waiting for telemetry data…</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Seq #</th>
                <th>Temp (°C)</th>
                <th>Shelf %</th>
                <th>Compressor</th>
                <th>Replay</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {records.map((r) => (
                <tr key={r.id} className="animate-slide-in">
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: DEVICE_HUE[r.device_id] || '#94a3b8',
                          flexShrink: 0,
                          display: 'inline-block',
                        }}
                      />
                      <span className="font-mono" style={{ color: DEVICE_HUE[r.device_id] || '#e2e8f8', fontSize: '0.72rem' }}>
                        {r.device_id}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: '#e2e8f8' }}>#{r.seq}</td>
                  <td><TempCell temp={r.temperature} /></td>
                  <td>
                    {r.shelf_life !== null ? (
                      <span style={{ color: r.shelf_life < 20 ? '#f87171' : '#94a3b8' }}>
                        {r.shelf_life.toFixed(1)}%
                      </span>
                    ) : <span style={{ color: '#4a5a80' }}>—</span>}
                  </td>
                  <td>
                    {r.compressor === 'ON' ? (
                      <span className="badge badge-green">
                        <Power size={9} />
                        ON
                      </span>
                    ) : (
                      <span className="badge badge-gray">
                        <Power size={9} />
                        OFF
                      </span>
                    )}
                  </td>
                  <td>
                    {r.is_replayed ? (
                      <span className="badge badge-purple">
                        <RefreshCw size={9} />
                        Replay
                      </span>
                    ) : (
                      <span className="badge badge-cyan">Live</span>
                    )}
                  </td>
                  <td style={{ color: '#4a5a80' }}>{formatTimestamp(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
