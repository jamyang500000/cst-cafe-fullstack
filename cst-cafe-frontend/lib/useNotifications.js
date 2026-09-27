"use client";

// Loads the logged-in user's notifications. New ones arrive instantly through
// live updates; a slow check every 60 seconds is a backup in case the live
// connection drops. Used by NotificationBell (customers) and
// StaffNotificationSidebar (staff).

import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useLiveEvent } from "@/lib/LiveEvents";

const BACKUP_REFRESH_MS = 60000;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const refresh = useCallback(() => {
    if (!user) return;
    api("/notifications")
      .then((data) =>
        setNotifications(data.notifications.map((n) => ({ ...n, time: timeAgo(n.createdAt) })))
      )
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    refresh();
    const interval = setInterval(refresh, BACKUP_REFRESH_MS);
    return () => clearInterval(interval);
  }, [user, refresh]);

  useLiveEvent("notifications", refresh);

  // Update the screen straight away, then tell the server.
  function markOneRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api(`/notifications/${id}/read`, { method: "PATCH" }).catch(refresh);
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api("/notifications/read-all", { method: "POST" }).catch(refresh);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount, markOneRead, markAllRead, refresh };
}
