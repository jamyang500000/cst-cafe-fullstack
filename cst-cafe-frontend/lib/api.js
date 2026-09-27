// Talks to the CST Cafe backend (cst-cafe-backend).
// Usage:  const data = await api("/menu");
//         await api("/orders", { method: "POST", body: { items } });
// Errors are thrown as ApiError with a readable `message` and, for forms,
// `details` like { email: "Email already in use" }.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const TOKEN_KEY = "cst-cafe-token";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked (e.g. private mode) - login lasts until the tab closes.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Can't reach the server. Make sure the backend is running (npm run dev in cst-cafe-backend).",
      0
    );
  }

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    // Token expired or account gone: log out everywhere in the app.
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event("cst-cafe-logout"));
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}

// "just now", "5m ago", "2h ago", "3d ago"
export function timeAgo(isoDate) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// "August 2026"
export function monthYear(isoDate) {
  if (!isoDate) return "";
  return new Date(isoDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// "12:05 PM"
export function clockTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
