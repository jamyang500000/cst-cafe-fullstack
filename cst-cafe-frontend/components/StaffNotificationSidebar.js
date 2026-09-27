"use client";

import { useNotifications } from "@/lib/useNotifications";

export default function StaffNotificationSidebar() {
  const { notifications, unreadCount, markOneRead, markAllRead } = useNotifications();

  return (
    <aside className="shrink-0 border-t border-border bg-card px-4 py-6 sm:px-8 xl:w-72 xl:border-l xl:border-t-0 xl:px-5 xl:py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg text-pine">Notifications</p>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-xs text-muted">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs text-pine hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 max-h-96 space-y-2 overflow-y-auto xl:max-h-[calc(100vh-12rem)]">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted">Nothing new right now.</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markOneRead(n.id)}
              className={`w-full rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-paper ${
                n.read ? "bg-paper" : "bg-pine/5"
              }`}
            >
              <div className="flex items-start gap-2">
                {!n.read && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pine" />
                )}
                <div className={n.read ? "pl-3.5" : ""}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-muted/70 mt-1">{n.time}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}