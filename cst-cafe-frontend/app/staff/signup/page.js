"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { staffRoles as roles } from "@/lib/constants";

export default function StaffSignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: roles[0],
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) {
      next.name = "Name is required";
    }
    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (!form.password) {
      next.password = "Password is required";
    } else if (form.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }
    if (form.confirmPassword !== form.password) {
      next.confirmPassword = "Passwords don't match";
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
      await signup(
        { name: form.name, email: form.email, role: form.role, password: form.password },
        "staff"
      );
      router.push("/staff");
    } catch (err) {
      setErrors({ form: err.message || "Something went wrong. Try again.", ...err.details });
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">
            Staff Portal
          </p>
          <Link href="/" className="mt-2 block font-display text-2xl text-pine">
            CST Cafe
          </Link>
          <p className="mt-1 text-sm text-muted">Create your staff account</p>
        </div>

        {errors.form && (
          <p className="mb-4 text-sm text-delayed bg-delayed/10 border border-delayed/20 rounded-lg px-3 py-2">
            {errors.form}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              autoComplete="name"
              className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
              placeholder="Full name"
            />
            {errors.name && <p className="mt-1 text-xs text-delayed">{errors.name}</p>}
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
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
              placeholder="you@cstcafe.bt"
            />
            {errors.email && <p className="mt-1 text-xs text-delayed">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
              placeholder="At least 8 characters"
            />
            {errors.password && <p className="mt-1 text-xs text-delayed">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pine/40"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-delayed">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-pine text-paper font-medium py-2.5 hover:bg-pine/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have a staff account?{" "}
          <Link href="/staff/login" className="text-pine font-medium hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted">
          <Link href="/" className="hover:underline">
            Back to customer site
          </Link>
        </p>
      </div>
    </main>
  );
}