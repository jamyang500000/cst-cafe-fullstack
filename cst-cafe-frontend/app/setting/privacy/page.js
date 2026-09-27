"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

// Each switch is saved to your account and changes how the app behaves.
const settingsList = [
  {
    key: "shareOrderHistory",
    label: "Share my order history to help improve the menu",
    help: "Your orders are counted in the cafe's “most popular items” report.",
  },
  {
    key: "orderNotifications",
    label: "Notify me about my order status",
    help: "Get a notification when your order is being prepared, delayed or ready.",
  },
  {
    key: "recommendations",
    label: "Show me personalized menu recommendations",
    help: "Shows a “Your favourites” row on the menu with what you order most.",
  },
];

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState("");

  // Must be logged in to see your settings.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/setting/privacy");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.accountType !== "customer") return;
    api("/users/me/privacy")
      .then((data) => setSettings(data.privacy))
      .catch((err) => setError(err.message));
  }, [user]);

  async function toggle(key) {
    const next = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: next })); // update the screen straight away
    setSavingKey(key);
    setError("");
    try {
      const data = await api("/users/me/privacy", { method: "PATCH", body: { [key]: next } });
      setSettings(data.privacy);
    } catch (err) {
      setSettings((prev) => ({ ...prev, [key]: !next })); // put it back
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
      <button
        onClick={() => router.back()}
        className="text-sm text-muted hover:text-foreground"
      >
        ← Back
      </button>

      <h1 className="mt-3 font-display text-2xl text-pine">Privacy settings</h1>
      <p className="mt-1 text-sm text-muted">
        Control what CST Cafe shares and uses from your account. Changes are saved
        automatically.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-delayed/20 bg-delayed/10 px-3 py-2 text-sm text-delayed">
          {error}
        </p>
      )}

      {user && user.accountType !== "customer" ? (
        <p className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
          These settings are for customer accounts. Staff accounts don&apos;t have
          order history or recommendations.
        </p>
      ) : !settings ? (
        <p className="mt-6 text-sm text-muted">{error ? "" : "Loading…"}</p>
      ) : (
        <div className="mt-6 space-y-2">
          {settingsList.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm text-foreground">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted">{s.help}</p>
              </div>
              <button
                onClick={() => toggle(s.key)}
                disabled={savingKey === s.key}
                aria-pressed={settings[s.key]}
                aria-label={s.label}
                className={`flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors ${
                  settings[s.key] ? "bg-pine justify-end" : "bg-border justify-start"
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 opacity-70">
            <span className="text-sm text-foreground">
              Feedback is always anonymous — no name is ever attached
            </span>
            <button
              disabled
              aria-pressed="true"
              className="flex h-6 w-11 flex-none items-center justify-end rounded-full bg-pine p-0.5 cursor-not-allowed"
            >
              <span className="h-5 w-5 rounded-full bg-white shadow" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
