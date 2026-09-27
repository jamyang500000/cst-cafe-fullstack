"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { api, monthYear } from "@/lib/api";
import { useRequireAuth } from "@/lib/AuthContext";

export default function StaffProfilePage() {
  const { user, ready, setUser } = useRequireAuth("staff");
  const [form, setForm] = useState({ name: "", email: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email });
  }, [user]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api("/users/me", { method: "PATCH", body: form });
      setUser(data.user);
      setSaved(true);
    } catch (err) {
      setErrors({ form: err.message, ...err.details });
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const initials = form.name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
      <Link href="/staff" className="text-sm text-muted hover:text-foreground">
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pine text-lg font-medium text-paper">
          {initials}
        </span>
        <div>
          <h1 className="font-display text-2xl text-pine">Your profile</h1>
          <p className="text-sm text-muted">Staff since {monthYear(user.memberSince)}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            Staff email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1">
            Role
          </label>
          <input
            id="role"
            type="text"
            value={user.role || ""}
            readOnly
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted"
          />
          <p className="mt-1 text-xs text-muted">Ask a manager if your role needs to change.</p>
        </div>

        {errors.form && <p className="text-sm text-delayed">{errors.form}</p>}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-pine px-5 py-2 text-sm text-paper hover:bg-pine/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-ready">Saved</span>}
        </div>
      </form>

      <ChangePasswordForm />
    </main>
  );
}