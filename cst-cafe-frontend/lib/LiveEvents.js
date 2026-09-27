"use client";

// Live updates from the backend (Server-Sent Events).
// One connection per logged-in browser tab; any component can listen:
//   useLiveEvent("order", (data) => reloadOrder(data.id));
//   const { connected } = useLiveStatus();

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, clearToken, getToken } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const LiveContext = createContext(null);
const EVENT_NAMES = ["order", "notifications", "logout"];

export function LiveEventsProvider({ children }) {
  const { user } = useAuth();
  const listeners = useRef(new Map()); // event name -> Set of handlers
  const [connected, setConnected] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    const token = userId && getToken();
    if (!token) {
      setConnected(false);
      return;
    }
    const source = new EventSource(`${API_URL}/events?token=${encodeURIComponent(token)}`);
    source.addEventListener("connected", () => setConnected(true));
    source.onerror = () => setConnected(false); // the browser retries by itself

    for (const name of EVENT_NAMES) {
      source.addEventListener(name, (e) => {
        let data = {};
        try {
          data = JSON.parse(e.data);
        } catch {}
        for (const handler of listeners.current.get(name) || []) handler(data);
      });
    }

    // A manager disabled this account: log out straight away.
    source.addEventListener("logout", () => {
      source.close();
      clearToken();
      window.dispatchEvent(new Event("cst-cafe-logout"));
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [userId]);

  const subscribe = useCallback((name, handler) => {
    if (!listeners.current.has(name)) listeners.current.set(name, new Set());
    listeners.current.get(name).add(handler);
    return () => listeners.current.get(name).delete(handler);
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

// Run `handler` every time the backend sends this event.
export function useLiveEvent(name, handler) {
  const context = useContext(LiveContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!context) return;
    return context.subscribe(name, (data) => latest.current(data));
  }, [context, name]);
}

export function useLiveStatus() {
  return { connected: useContext(LiveContext)?.connected ?? false };
}
