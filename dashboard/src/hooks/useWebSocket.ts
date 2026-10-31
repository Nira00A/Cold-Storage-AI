import { useEffect, useRef, useCallback, useState } from "react";
import type { WsMessage, WsStatus } from "../types";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? "ws://localhost:8000/ws/dashboard"
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/dashboard`);
const RECONNECT_DELAY_MS = 3000;

interface UseWebSocketReturn {
  status: WsStatus;
  lastMessage: WsMessage | null;
  liveStats: { inserted: number; duplicates: number };
}

export function useWebSocket(
  onMessage: (msg: WsMessage) => void,
): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>("OFFLINE");
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [liveStats, setLiveStats] = useState({ inserted: 0, duplicates: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }

    setStatus("RECONNECTING");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("LIVE");
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data: WsMessage = JSON.parse(event.data);
        setLastMessage(data);
        setLiveStats((prev) => ({
          inserted: prev.inserted + (data.inserted || 0),
          duplicates: prev.duplicates + (data.duplicates || 0),
        }));
        onMessageRef.current(data);
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("OFFLINE");
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastMessage, liveStats };
}
