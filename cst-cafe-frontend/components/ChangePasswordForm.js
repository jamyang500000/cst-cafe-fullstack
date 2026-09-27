"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40";

// Used on both the customer and staff profile pages.
export default function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.currentPassword) next.currentPassword = "Enter your current password";
    if (form.newPassword.length < 8) next.newPassword = "New password must be at least 8 characters";
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await api("/users/me/password", {
        method: "PATCH",
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved(true);
    } catch (err) {
      setErrors({ form: err.message, ...err.details });
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ["currentPassword", "Current password", "current-password"],
    ["newPassword", "New password", "new-password"],
    ["confirmPassword", "Confirm new password", "new-password"],
  ];

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="font-display text-lg text-pine">Change password</h2>
      {fields.map(([name, label, autoComplete]) => (
        <div key={name}>
          <label htmlFor={name} className="block text-sm font-medium text-foreground mb-1">
            {label}
          </label>
          <input
            id={name}
            name={name}
            type="password"
            value={form[name]}
            onChange={handleChange}
            autoComplete={autoComplete}
            className={inputClass}
          />
          {errors[name] && <p className="mt-1 text-xs text-delayed">{errors[name]}</p>}
        </div>
      ))}
      {errors.form && <p className="text-sm text-delayed">{errors.form}</p>}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full border border-pine px-5 py-2 text-sm text-pine hover:bg-pine/5 transition-colors disabled:opacity-60"
        >
          {saving ? "Updating…" : "Update password"}
        </button>
        {saved && <span className="text-sm text-ready">Password updated</span>}
      </div>
    </form>
  );
}
