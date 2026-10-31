import React from 'react';
import type { WsStatus, DeviceId } from '../types';
import { Thermometer, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface HeaderProps {
  wsStatus: WsStatus;
  selectedDevice: DeviceId;
  onDeviceChange: (d: DeviceId) => void;
  liveStats: { inserted: number; duplicates: number };
}

const DEVICES: { value: DeviceId; label: string }[] = [
  { value: 'all', label: 'All Devices' },
  { value: 'cold-unit-01', label: 'cold-unit-01' },
  { value: 'cold-unit-02', label: 'cold-unit-02' },
  { value: 'cold-unit-03', label: 'cold-unit-03' },
];

const WsIndicator: React.FC<{ status: WsStatus }> = ({ status }) => {
  const configs = {
    LIVE: {
      dot: 'animate-pulse-green',
      dotColor: 'bg-emerald-400',
      textColor: 'text-emerald-400',
      label: 'LIVE',
      Icon: Wifi,
    },
    RECONNECTING: {
      dot: 'animate-pulse-amber',
      dotColor: 'bg-amber-400',
      textColor: 'text-amber-400',
      label: 'RECONNECTING',
      Icon: Loader2,
    },
    OFFLINE: {
      dot: 'animate-pulse-red',
      dotColor: 'bg-red-400',
      textColor: 'text-red-400',
      label: 'OFFLINE',
      Icon: WifiOff,
    },
  };
  const cfg = configs[status];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.18)' }}>
      <span
        className={`w-2 h-2 rounded-full ${cfg.dotColor} ${cfg.dot}`}
        style={{ flexShrink: 0 }}
      />
      <cfg.Icon
        size={13}
        className={`${cfg.textColor} ${status === 'RECONNECTING' ? 'animate-spin-slow' : ''}`}
      />
      <span className={`text-xs font-bold tracking-widest ${cfg.textColor}`}>
        {cfg.label}
      </span>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  selectedDevice,
  onDeviceChange,
  liveStats,
}) => {
  return (
    <header
      style={{
        background: 'linear-gradient(180deg, rgba(13,17,24,0.98) 0%, rgba(5,7,10,0.98) 100%)',
        borderBottom: '1px solid rgba(148,163,184,0.16)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg animate-glow-pulse"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
              boxShadow: '0 0 12px rgba(96,165,250,0.4)',
            }}
          >
            <Thermometer size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide" style={{ color: '#f8fafc' }}>
              Cold Storage Industrial Telemetry Engine
            </h1>
            <p className="text-xs" style={{ color: '#687386' }}>
              Real-time · Incident Monitoring · AI Diagnostics
            </p>
          </div>
        </div>

        {/* Right: Stats + WS + Device Select */}
        <div className="flex items-center gap-4">
          {/* Live session counters */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex flex-col items-center">
              <span className="font-mono font-bold text-emerald-400 text-sm leading-tight">
                {liveStats.inserted.toLocaleString()}
              </span>
              <span style={{ color: '#4a5a80' }}>Inserted</span>
            </div>
            <div
              style={{ width: 1, height: 28, background: 'rgba(99,126,195,0.2)' }}
            />
            <div className="flex flex-col items-center">
              <span className="font-mono font-bold text-amber-400 text-sm leading-tight">
                {liveStats.duplicates.toLocaleString()}
              </span>
              <span style={{ color: '#4a5a80' }}>Dupes</span>
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: 'rgba(99,126,195,0.2)' }} />

          <WsIndicator status={wsStatus} />

          <div className="relative">
            <select
              id="device-filter"
              className="select-dark pr-8"
              value={selectedDevice}
              onChange={(e) => onDeviceChange(e.target.value as DeviceId)}
              aria-label="Select device filter"
            >
              {DEVICES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
