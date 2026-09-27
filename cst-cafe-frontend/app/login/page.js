"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, nextPath } from "@/lib/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (!form.password) {
      next.password = "Password is required";
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await login(form.email, form.password, "customer");
      router.push(nextPath("/menu"));
    } catch (err) {
      setErrors({ form: err.message || "Something went wrong. Try again.", ...err.details });
      setSubmitting(false);
    }
  }

  return (
    <main className="force-light min-h-screen flex items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-amber-100 p-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-amber-900">
            CST Cafe
          </Link>
          <p className="text-sm text-amber-700/70 mt-1">Log in to your account</p>
        </div>

        {errors.form && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {errors.form}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-amber-900 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-amber-900 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-800 text-white font-medium py-2.5 hover:bg-amber-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-amber-700/70">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-amber-900 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}