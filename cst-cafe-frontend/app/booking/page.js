"use client";

import { useEffect, useState } from "react";
import CustomerNav from "@/components/CustomerNav";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/AuthContext";

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookingPage() {
  const { ready } = useRequireAuth("customer");
  const [tables, setTables] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [booking, setBooking] = useState(null); // the confirmed booking from the server
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [customTime, setCustomTime] = useState("");
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [confirmed, setConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // On load: preset times, and any upcoming booking the customer already has.
  useEffect(() => {
    if (!ready) return;
    Promise.all([api("/time-slots"), api("/bookings/mine")])
      .then(([slots, mine]) => {
        setTimeSlots(slots.timeSlots);
        const upcoming = mine.bookings.find(
          (b) => b.status === "confirmed" && b.date >= todayString()
        );
        if (upcoming) {
          setBooking(upcoming);
          setConfirmed(true);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ready]);

  // Tables that fit the party, marked free/booked for the chosen time.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams({ partySize: String(partySize) });
    if (selectedTime) params.set("time", selectedTime);
    api(`/tables?${params}`)
      .then((data) => {
        setTables(data.tables);
        const chosen = data.tables.find((t) => t.id === selectedTable);
        if (selectedTable && (!chosen || !chosen.available)) setSelectedTable(null);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, partySize, selectedTime, refreshKey]);

  const canBook = selectedTable && selectedTime && !saving;

  async function handleConfirm() {
    if (!canBook) return;
    setSaving(true);
    setError("");
    try {
      const data = await api("/bookings", {
        method: "POST",
        body: { tableId: selectedTable, time: selectedTime, partySize },
      });
      setBooking(data.booking);
      setConfirmed(true);
      setCancelled(false);
    } catch (err) {
      setError(err.message);
      // Someone may have just taken that table - refresh the list.
      setSelectedTable(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  function handlePresetClick(slot) {
    setUseCustomTime(false);
    setSelectedTime(slot);
  }

  function handleCustomToggle() {
    setUseCustomTime(true);
    setSelectedTime(customTime || null);
  }

  function handleCustomTimeChange(e) {
    const value = e.target.value;
    setCustomTime(value);
    setSelectedTime(value ? formatTime(value) : null);
  }

  function formatTime(value) {
    const [hourStr, minute] = value.split(":");
    let hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
  }

  function resetBookingState() {
    setBooking(null);
    setError("");
    setConfirmed(false);
    setCancelling(false);
    setCancelled(false);
    setSelectedTable(null);
    setSelectedTime(null);
    setUseCustomTime(false);
    setCustomTime("");
    setPartySize(2);
  }

  async function handleCancelBooking() {
    setSaving(true);
    try {
      await api(`/bookings/${booking.id}`, { method: "DELETE" });
      setCancelled(true);
      setCancelling(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <>
        <CustomerNav />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      </>
    );
  }

  // --- Cancelled state ---
  if (cancelled) {
    return (
      <>
        <CustomerNav />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-wide text-muted">
            Booking cancelled
          </p>
          <h1 className="mt-2 font-display text-3xl text-pine">
            Your table has been released
          </h1>
          <p className="mt-3 max-w-sm text-sm text-muted">
            No worries — you can make a new reservation any time.
          </p>
          <button
            onClick={resetBookingState}
            className="mt-8 rounded-full bg-amber px-5 py-2 text-sm text-paper hover:bg-amber-light"
          >
            Make a new booking
          </button>
        </main>
      </>
    );
  }

  // --- Confirmed state ---
  if (confirmed && booking) {
    const table = { label: booking.table, nearWindow: booking.nearWindow };
    const bookedTime = booking.time;
    const guests = booking.partySize;
    return (
      <>
        <CustomerNav />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-wide text-amber">
            Booking confirmed
          </p>
          <h1 className="mt-2 font-display text-3xl text-pine">
            You&apos;re booked for {bookedTime}
          </h1>
          <p className="mt-3 text-muted">
            {table.label}
            {table.nearWindow ? " (near window)" : ""} · {guests}{" "}
            {guests === 1 ? "guest" : "guests"}
          </p>
          <p className="mt-6 max-w-sm text-sm text-muted">
            We&apos;ll notify you when your table is ready. Head to the Menu
            tab to pre-order your food so it&apos;s ready when you arrive.
          </p>

          {error && <p className="mt-4 text-sm text-delayed">{error}</p>}
          <div className="mt-8 flex gap-3">
            <button
              onClick={resetBookingState}
              className="rounded-full border border-border px-5 py-2 text-sm hover:border-pine/40"
            >
              Make another booking
            </button>
            <button
              onClick={() => setCancelling(true)}
              className="rounded-full border border-red-300 px-5 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Cancel booking
            </button>
          </div>

          {cancelling && (
            <div className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 p-5 text-left">
              <p className="text-sm font-medium text-red-700">
                Cancel this booking?
              </p>
              <p className="mt-1 text-sm text-red-600/80">
                {table.label} at {bookedTime} for {guests}{" "}
                {guests === 1 ? "guest" : "guests"} will be released. This
                can&apos;t be undone.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleCancelBooking}
                  disabled={saving}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
                >
                  Yes, cancel it
                </button>
                <button
                  onClick={() => setCancelling(false)}
                  className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-pine/40"
                >
                  Keep booking
                </button>
              </div>
            </div>
          )}
        </main>
      </>
    );
  }

  // --- Booking form ---
  return (
    <>
      <CustomerNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-3xl text-pine">Book a table</h1>
        <p className="mt-2 text-muted">
          Reserve a table and a pickup time so you don&apos;t have to wait in
          line during peak hours.
        </p>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Party size
          </h2>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setPartySize(n)}
                className={`h-10 w-10 rounded-full border text-sm ${
                  partySize === n
                    ? "border-pine bg-pine text-paper"
                    : "border-border hover:border-pine/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Available tables
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tables
              .filter((t) => t.seats >= partySize)
              .map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table.id)}
                  disabled={!table.available}
                  className={`rounded-xl border p-4 text-left ${
                    selectedTable === table.id
                      ? "border-pine bg-pine/5"
                      : "border-border hover:border-pine/40"
                  } ${!table.available ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <p className="font-medium">
                    {table.label}
                    {!table.available && (
                      <span className="ml-2 text-xs font-normal text-delayed">Booked</span>
                    )}
                  </p>
                  <p className="text-sm text-muted">Seats {table.seats}</p>
                  {table.nearWindow && (
                    <span className="mt-1.5 inline-block rounded-full bg-amber/15 px-2 py-0.5 text-xs text-amber">
                      Near window
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Pickup / arrival time
          </h2>
          <div className="flex flex-wrap gap-2">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => handlePresetClick(slot)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  !useCustomTime && selectedTime === slot
                    ? "border-pine bg-pine text-paper"
                    : "border-border hover:border-pine/40"
                }`}
              >
                {slot}
              </button>
            ))}
            <button
              onClick={handleCustomToggle}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                useCustomTime
                  ? "border-pine bg-pine text-paper"
                  : "border-border hover:border-pine/40"
              }`}
            >
              Custom time
            </button>
          </div>

          {useCustomTime && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="time"
                value={customTime}
                onChange={handleCustomTimeChange}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:border-pine/60 focus:outline-none"
              />
              {selectedTime && (
                <span className="text-sm text-muted">
                  Selected: {selectedTime}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-delayed/20 bg-delayed/10 px-3 py-2 text-sm text-delayed">
            {error}
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canBook}
          className="mt-10 w-full rounded-full bg-amber py-3 text-paper transition-colors hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Booking…" : "Confirm booking"}
        </button>
      </main>
    </>
  );
}