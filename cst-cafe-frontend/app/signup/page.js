"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, nextPath } from "@/lib/AuthContext";

const inputClass =
  "w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
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
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (form.phone.trim() && !/^[0-9+\- ]{6,20}$/.test(form.phone.trim())) {
      next.phone = "Enter a valid phone number";
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
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      router.push(nextPath("/menu"));
    } catch (err) {
      setErrors({ form: err.message || "Something went wrong. Try again.", ...err.details });
      setSubmitting(false);
    }
  }

  return (
    <main className="force-light min-h-screen flex items-center justify-center bg-amber-50 px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-amber-100 p-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-amber-900">
            CST Cafe
          </Link>
          <p className="text-sm text-amber-700/70 mt-1">Create your account</p>
        </div>

        {errors.form && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {errors.form}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-amber-900 mb-1">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              className={inputClass}
              placeholder="Karma Wangdi"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

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
              className={inputClass}
              placeholder="you@rub.edu.bt"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-amber-900 mb-1">
              Phone <span className="font-normal text-amber-700/60">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              className={inputClass}
              placeholder="17123456"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
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
              autoComplete="new-password"
              className={inputClass}
              placeholder="At least 8 characters"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-amber-900 mb-1">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className={inputClass}
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-800 text-white font-medium py-2.5 hover:bg-amber-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-amber-700/70">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-900 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
