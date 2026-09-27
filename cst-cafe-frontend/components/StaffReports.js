"use client";

// "Reports" tab on the staff dashboard: today's numbers, busiest hours and
// the most popular items (from GET /api/reports/summary).

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function formatHour(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12} ${suffix}`;
}

function StatTile({ label, value, note }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl text-pine">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

export default function StaffReports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/reports/summary")
      .then(setReport)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-delayed">{error}</p>;
  if (!report) return <p className="text-sm text-muted">Loading reports…</p>;

  const { orders, bookings, feedback, ordersByHour, popularItems } = report;
  const busiest = Math.max(1, ...ordersByHour.map((h) => h.orders));
  const topQuantity = Math.max(1, ...popularItems.items.map((i) => i.quantity));

  return (
    <>
      <h1 className="font-display text-2xl text-pine">Today&apos;s report</h1>
      <p className="mt-1 text-sm text-muted">
        {new Date(`${report.date}T00:00:00`).toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Orders" value={orders.total} note={`${orders.active} still in progress`} />
        <StatTile label="Revenue" value={`Nu. ${orders.revenue}`} note="excluding cancelled" />
        <StatTile
          label="Picked up"
          value={orders.completed}
          note={`${orders.cancelled} cancelled · ${orders.takeaway} takeaway`}
        />
        <StatTile
          label="Bookings"
          value={bookings.total}
          note={feedback.average ? `★ ${feedback.average} avg rating` : "No ratings yet"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">Orders by hour</h2>
          {ordersByHour.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No orders yet today.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {ordersByHour.map((h) => (
                <div key={h.hour} className="flex items-center gap-3 text-sm">
                  <span className="w-12 shrink-0 text-muted">{formatHour(h.hour)}</span>
                  <div className="h-3 flex-1 rounded-full bg-paper">
                    <div
                      className="h-3 rounded-full bg-amber"
                      style={{ width: `${(h.orders / busiest) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right">{h.orders}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">
            Most popular (last {popularItems.days} days)
          </h2>
          {popularItems.items.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No orders yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {popularItems.items.map((item) => (
                <div key={item.name} className="text-sm">
                  <div className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-muted">
                      {item.quantity} sold · Nu. {item.revenue}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper">
                    <div
                      className="h-2 rounded-full bg-pine"
                      style={{ width: `${(item.quantity / topQuantity) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
