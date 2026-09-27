"use client";

import { useCallback, useEffect, useState } from "react";
import StaffNotificationSidebar from "@/components/StaffNotificationSidebar";
import ProfileMenu from "@/components/ProfileMenu";
import SettingsMenu from "@/components/SettingsMenu";
import StaffReports from "@/components/StaffReports";
import StaffAccounts from "@/components/StaffAccounts";
import { api, clockTime, timeAgo } from "@/lib/api";
import { useRequireAuth } from "@/lib/AuthContext";
import { useLiveEvent, useLiveStatus } from "@/lib/LiveEvents";
import { statusStyles } from "@/lib/constants";

const baseTabs = ["Queue", "Menu", "Feedback", "Reports"];
const QUEUE_BACKUP_REFRESH_MS = 30000; // live updates are instant; this is a backup

// Button text for each status an order can be moved to.
const actionLabels = {
  preparing: "Start preparing",
  ready: "Mark ready",
  picked_up: "Picked up",
  delayed: "Delay",
};

const orderTypeStyles = {
  "dine-in": { label: "Dine in", className: "bg-pine/10 text-pine" },
  takeaway: { label: "Takeaway", className: "bg-amber/15 text-amber" },
};

const menuCategories = ["Meals", "Snacks", "Beverages"];

const emptyForm = {
  name: "",
  category: menuCategories[0],
  price: "",
  prepTime: "",
  description: "",
  image: "",
};

export default function StaffDashboard() {
  const { user, ready } = useRequireAuth("staff");
  const [activeTab, setActiveTab] = useState("Queue");
  const [error, setError] = useState("");

  // --- Queue state ---
  const [queue, setQueue] = useState([]);
  const [nextStatus, setNextStatus] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  // --- Menu management state ---
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [removingId, setRemovingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  // --- Feedback state ---
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [averageRating, setAverageRating] = useState(null);

  const loadQueue = useCallback(() => {
    return api("/orders/queue")
      .then((data) => {
        setQueue(data.orders);
        setNextStatus(data.nextStatus);
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadMenu = useCallback(() => {
    return api("/menu")
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, []);

  const loadFeedback = useCallback(() => {
    return api("/feedback")
      .then((data) => {
        setFeedbackEntries(data.entries.map((f) => ({ ...f, time: timeAgo(f.createdAt) })));
        setAverageRating(data.averageRating);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Load the open tab's data; keep the queue refreshing while it's open.
  useEffect(() => {
    if (!ready) return;
    setError("");
    if (activeTab === "Queue") {
      loadQueue();
      const interval = setInterval(loadQueue, QUEUE_BACKUP_REFRESH_MS);
      return () => clearInterval(interval);
    }
    if (activeTab === "Menu") loadMenu();
    if (activeTab === "Feedback") loadFeedback();
  }, [ready, activeTab, loadQueue, loadMenu, loadFeedback]);

  // Any order placed or changed -> reload the queue straight away.
  const { connected } = useLiveStatus();
  useLiveEvent("order", () => {
    if (activeTab === "Queue") loadQueue();
  });

  // Runs a change on the server and shows any error at the top.
  async function run(action) {
    setError("");
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function changeStatus(id, status) {
    setUpdatingId(id);
    await run(() => api(`/orders/${id}/status`, { method: "PATCH", body: { status } }));
    await loadQueue();
    setUpdatingId(null);
  }

  async function toggleAvailability(id) {
    await run(async () => {
      const data = await api(`/menu/${id}/availability`, { method: "PATCH" });
      setItems((prev) => prev.map((item) => (item.id === id ? data.item : item)));
    });
  }

  function startEdit(item) {
    setShowAddForm(false);
    setRemovingId(null);
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      price: item.price,
      prepTime: item.prepTime,
      description: item.description,
      image: item.image || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    if (!editForm.name.trim()) return;
    const ok = await run(async () => {
      const data = await api(`/menu/${id}`, {
        method: "PATCH",
        body: {
          name: editForm.name.trim(),
          category: editForm.category,
          price: String(editForm.price),
          prepTime: String(editForm.prepTime).trim() || "5 min",
          description: editForm.description.trim(),
          image: editForm.image.trim() || null,
        },
      });
      setItems((prev) => prev.map((item) => (item.id === id ? data.item : item)));
    });
    if (ok) setEditingId(null);
  }

  async function confirmRemove(id) {
    const ok = await run(() => api(`/menu/${id}`, { method: "DELETE" }));
    if (ok) setItems((prev) => prev.filter((item) => item.id !== id));
    setRemovingId(null);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    const ok = await run(async () => {
      const data = await api("/menu", {
        method: "POST",
        body: {
          name: addForm.name.trim(),
          category: addForm.category,
          price: String(addForm.price),
          prepTime: addForm.prepTime.trim() || "5 min",
          description: addForm.description.trim(),
          image: addForm.image.trim() || undefined,
        },
      });
      setItems((prev) => [...prev, data.item]);
    });
    if (ok) {
      setAddForm(emptyForm);
      setShowAddForm(false);
    }
  }

  // Only Managers see the Accounts tab.
  const tabs = user?.role === "Manager" ? [...baseTabs, "Accounts"] : baseTabs;

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div>
          <p className="font-display text-lg text-pine">CST Cafe</p>
          <p className="text-xs text-muted">Staff dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-xs text-muted"
            title={connected ? "New orders appear instantly" : "Reconnecting… (checking every 30s meanwhile)"}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-ready" : "bg-border"}`} />
            <span className="hidden sm:inline">{connected ? "Live" : "Connecting…"}</span>
          </span>
          <ProfileMenu user={user} profileHref="/staff/profile" />
          <SettingsMenu logoutHref="/staff/login" />
        </div>
      </header>

      {/* Wide screens: menu | content | notifications side by side.
          Smaller screens: tabs on top, content, then notifications below. */}
      <div className="flex flex-1 flex-col xl:flex-row">
        <aside className="shrink-0 border-b border-border bg-card px-4 py-3 xl:w-56 xl:border-b-0 xl:border-r xl:px-5 xl:py-8">
          <nav className="flex gap-1 overflow-x-auto xl:flex-col">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${
                  activeTab === tab
                    ? "bg-pine text-paper"
                    : "text-foreground/70 hover:bg-paper"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {error && (
            <p className="mb-4 rounded-lg border border-delayed/20 bg-delayed/10 px-3 py-2 text-sm text-delayed">
              {error}
            </p>
          )}
          {activeTab === "Queue" && (
            <>
              <h1 className="font-display text-2xl text-pine">Active queue</h1>
              <p className="mt-1 text-sm text-muted">
                Update an order&apos;s status as it moves through preparation.
              </p>

              <div className="mt-6 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="bg-card text-left text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Table</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted">
                          No active orders right now. New orders appear here automatically.
                        </td>
                      </tr>
                    )}
                    {queue.map((order) => {
                      const status = statusStyles[order.status];
                      const type = orderTypeStyles[order.orderType] || orderTypeStyles["dine-in"];
                      return (
                        <tr key={order.id} className="border-t border-border">
                          <td className="px-4 py-3 font-medium">
                            {order.code}
                            <span className="block text-xs font-normal text-muted">
                              #{order.queueNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3">{order.customer}</td>
                          <td className="px-4 py-3">{order.table}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${type.className}`}
                            >
                              {type.label}
                            </span>
                          </td>
                          <td className="px-4 py-3" title={order.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}>
                            {order.itemCount}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {order.time || clockTime(order.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {(nextStatus[order.status] || [])
                                .filter((next) => actionLabels[next])
                                .map((next) => (
                                  <button
                                    key={next}
                                    onClick={() => changeStatus(order.id, next)}
                                    disabled={updatingId === order.id}
                                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
                                      next === "delayed"
                                        ? "border-delayed/30 text-delayed hover:border-delayed/60"
                                        : "border-border hover:border-pine/40"
                                    }`}
                                  >
                                    {actionLabels[next]}
                                  </button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "Menu" && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl text-pine">Menu items</h1>
                  <p className="mt-1 text-sm text-muted">
                    Toggle availability, edit details, or add and remove items.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddForm((prev) => !prev);
                    setEditingId(null);
                    setRemovingId(null);
                  }}
                  className="rounded-full bg-pine px-4 py-1.5 text-sm text-paper hover:bg-pine/90"
                >
                  {showAddForm ? "Cancel" : "+ Add item"}
                </button>
              </div>

              {showAddForm && (
                <form
                  onSubmit={addItem}
                  className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
                >
                  <input
                    type="text"
                    placeholder="Item name"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                    required
                  />
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                  >
                    {menuCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    placeholder="Price (Nu.)"
                    value={addForm.price}
                    onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                    className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Prep time (e.g. 10 min)"
                    value={addForm.prepTime}
                    onChange={(e) => setAddForm({ ...addForm, prepTime: e.target.value })}
                    className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    className="rounded-lg border border-border bg-paper px-3 py-2 text-sm sm:col-span-2"
                  />
                  <input
                    type="url"
                    placeholder="Image URL (optional, https://…)"
                    value={addForm.image}
                    onChange={(e) => setAddForm({ ...addForm, image: e.target.value })}
                    className="rounded-lg border border-border bg-paper px-3 py-2 text-sm sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="rounded-full bg-amber px-4 py-1.5 text-sm text-paper hover:bg-amber-light"
                    >
                      Add to menu
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-6 space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-card px-4 py-3"
                  >
                    {editingId === item.id ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                        />
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                        >
                          {menuCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={editForm.prepTime}
                          onChange={(e) => setEditForm({ ...editForm, prepTime: e.target.value })}
                          className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="rounded-lg border border-border bg-paper px-3 py-2 text-sm sm:col-span-2"
                        />
                        <input
                          type="url"
                          placeholder="Image URL (optional)"
                          value={editForm.image}
                          onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                          className="rounded-lg border border-border bg-paper px-3 py-2 text-sm sm:col-span-2"
                        />
                        <div className="flex gap-2 sm:col-span-2">
                          <button
                            onClick={() => saveEdit(item.id)}
                            className="rounded-full bg-pine px-4 py-1.5 text-xs text-paper hover:bg-pine/90"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-full border border-border px-4 py-1.5 text-xs hover:border-pine/40"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : removingId === item.id ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-foreground">
                          Remove <span className="font-medium">{item.name}</span> from the menu?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmRemove(item.id)}
                            className="rounded-full bg-delayed px-3 py-1 text-xs text-paper hover:opacity-90"
                          >
                            Yes, remove
                          </button>
                          <button
                            onClick={() => setRemovingId(null)}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:border-pine/40"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted">
                            {item.category} · Nu. {item.price} · {item.prepTime}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAvailability(item.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              item.available
                                ? "bg-ready/15 text-ready hover:bg-ready/25"
                                : "bg-delayed/15 text-delayed hover:bg-delayed/25"
                            }`}
                          >
                            {item.available ? "Available" : "Sold out"}
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:border-pine/40"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setRemovingId(item.id);
                              setEditingId(null);
                            }}
                            className="rounded-full border border-border px-3 py-1 text-xs text-delayed hover:border-delayed/40"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "Feedback" && (
            <>
              <h1 className="font-display text-2xl text-pine">Customer feedback</h1>
              <p className="mt-1 text-sm text-muted">
                Anonymous ratings and comments left by customers — no names are
                attached to any entry.
              </p>

              {feedbackEntries.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-lg text-amber">★</span>
                  <span className="font-display text-lg text-pine">
                    {averageRating}
                  </span>
                  <span className="text-sm text-muted">
                    average from {feedbackEntries.length}{" "}
                    {feedbackEntries.length === 1 ? "review" : "reviews"}
                  </span>
                </div>
              )}

              <div className="mt-6 space-y-2">
                {feedbackEntries.length === 0 ? (
                  <p className="text-sm text-muted">No feedback yet.</p>
                ) : (
                  feedbackEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={
                                n <= entry.rating ? "text-amber" : "text-border"
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-muted">{entry.time}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">
                        {entry.comment ? (
                          entry.comment
                        ) : (
                          <span className="italic text-muted">
                            No comment left.
                          </span>
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          {activeTab === "Reports" && <StaffReports />}
          {activeTab === "Accounts" && user.role === "Manager" && (
            <StaffAccounts currentUserId={user.id} />
          )}
        </main>

        <StaffNotificationSidebar />
      </div>
    </div>
  );
}