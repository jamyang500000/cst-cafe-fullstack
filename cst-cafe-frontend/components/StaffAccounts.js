"use client";

// "Accounts" tab on the staff dashboard - only shown to Managers.
// Change staff roles and disable / re-enable accounts.

import { useCallback, useEffect, useState } from "react";
import { api, monthYear } from "@/lib/api";

const filters = [
  { value: "", label: "Everyone" },
  { value: "staff", label: "Staff" },
  { value: "customer", label: "Customers" },
];

export default function StaffAccounts({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (search.trim()) params.set("search", search.trim());
    return api(`/admin/users?${params}`)
      .then((data) => {
        setUsers(data.users);
        setRoles(data.roles);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [type, search]);

  // Reload when the filter changes, or shortly after typing in the search box.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function save(id, path, body) {
    setSavingId(id);
    setError("");
    try {
      const data = await api(`/admin/users/${id}/${path}`, { method: "PATCH", body });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl text-pine">Accounts</h1>
      <p className="mt-1 text-sm text-muted">
        Change staff roles, or disable an account so it can no longer log in. Disabled
        accounts keep their order history.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setType(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              type === f.value
                ? "border-pine bg-pine text-paper"
                : "border-border text-foreground/70 hover:border-pine/40"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="w-full rounded-full sm:ml-auto sm:w-64 border border-border bg-paper px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine/40"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-delayed/20 bg-delayed/10 px-3 py-2 text-sm text-delayed">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[50rem] text-sm">
          <thead className="bg-card text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No accounts found.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              const busy = savingId === u.id;
              return (
                <tr key={u.id} className={`border-t border-border ${u.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {u.name}
                      {isMe && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.accountType}</td>
                  <td className="px-4 py-3">
                    {u.accountType === "staff" ? (
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={isMe || busy}
                        onChange={(e) => save(u.id, "role", { role: e.target.value })}
                        className="rounded-lg border border-border bg-paper px-2 py-1 text-sm disabled:opacity-60"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{u.orderCount}</td>
                  <td className="px-4 py-3 text-muted">{monthYear(u.memberSince)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.active ? "bg-ready/15 text-ready" : "bg-delayed/15 text-delayed"
                      }`}
                    >
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isMe ? null : confirmingId === u.id ? (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => save(u.id, "active", { active: false })}
                          disabled={busy}
                          className="whitespace-nowrap rounded-full bg-delayed px-3 py-1 text-xs text-paper hover:opacity-90"
                        >
                          Yes, disable
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="rounded-full border border-border px-3 py-1 text-xs hover:border-pine/40"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : u.active ? (
                      <button
                        onClick={() => setConfirmingId(u.id)}
                        className="rounded-full border border-border px-3 py-1 text-xs text-delayed hover:border-delayed/40"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => save(u.id, "active", { active: true })}
                        disabled={busy}
                        className="rounded-full border border-border px-3 py-1 text-xs text-pine hover:border-pine/40"
                      >
                        Enable
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
