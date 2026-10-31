import React from 'react';
import type { DeviceAudit } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Database, ArrowRight } from 'lucide-react';

interface SLACardsProps {
  audits: DeviceAudit[];
}

function CompletenessStatus({ pct }: { pct: number }) {
  if (pct >= 100) {
    return (
      <span className="badge badge-green">
        <CheckCircle2 size={10} />
        {pct.toFixed(2)}%
      </span>
    );
  } else if (pct >= 95) {
    return (
      <span className="badge badge-amber">
        <AlertTriangle size={10} />
        {pct.toFixed(2)}%
      </span>
    );
  }
  return (
    <span className="badge badge-red">
      <XCircle size={10} />
      {pct.toFixed(2)}%
    </span>
  );
}

const DEVICE_COLORS: Record<string, string> = {
  'cold-unit-01': '#60a5fa',
  'cold-unit-02': '#93c5fd',
  'cold-unit-03': '#38bdf8',
};

export const SLACards: React.FC<SLACardsProps> = ({ audits }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pt-5">
      {audits.map((audit) => {
        const color = DEVICE_COLORS[audit.device_id] || '#60a5fa';
        const fillPct = Math.min(100, audit.completeness_pct);
        const fillColor =
          audit.completeness_pct >= 100
            ? '#10b981'
            : audit.completeness_pct >= 95
            ? '#f59e0b'
            : '#ef4444';

        return (
          <div
            key={audit.device_id}
            className="glass-card p-4 relative overflow-hidden"
            style={{ borderLeft: `3px solid ${color}` }}
          >
            {/* Background accent */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
                transform: 'translate(20px, -20px)',
              }}
            />

            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database size={14} style={{ color }} />
                <span
                  className="text-xs font-bold tracking-wide font-mono"
                  style={{ color: '#f8fafc' }}
                >
                  {audit.device_id}
                </span>
              </div>
              <CompletenessStatus pct={audit.completeness_pct} />
            </div>

            {/* Sequence Range */}
            <div
              className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs" style={{ color: '#687386' }}>Seq Range:</span>
              <span className="font-mono text-xs font-semibold" style={{ color: '#8b9dc3' }}>
                {audit.min_seq.toLocaleString()}
              </span>
              <ArrowRight size={10} style={{ color: '#4a5a80' }} />
              <span className="font-mono text-xs font-semibold" style={{ color: '#8b9dc3' }}>
                {audit.max_seq.toLocaleString()}
              </span>
            </div>

            {/* Packets Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="font-mono font-bold text-sm" style={{ color: '#e2e8f8' }}>
                  {audit.received.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: '#4a5a80' }}>Received</div>
              </div>
              <div className="text-center">
                <div className="font-mono font-bold text-sm" style={{ color: '#94a3b8' }}>
                  {audit.expected.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: '#4a5a80' }}>Expected</div>
              </div>
              <div className="text-center">
                <div
                  className="font-mono font-bold text-sm"
                  style={{ color: audit.missing > 0 ? '#f87171' : '#34d399' }}
                >
                  {audit.missing.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: '#4a5a80' }}>Lost</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${fillPct}%`, background: fillColor }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: '#4a5a80' }}>SLA Completeness</span>
              <span className="text-xs font-mono font-bold" style={{ color: fillColor }}>
                {audit.completeness_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
