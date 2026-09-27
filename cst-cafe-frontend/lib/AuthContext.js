"use client";

// Keeps track of who is logged in, for the whole app.
//   const { user, login, logout } = useAuth();
//   const { user, loading } = useRequireAuth("customer");  // redirects if not logged in

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, getToken, setToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load, check whether a saved login is still valid.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this when the server says the login has expired.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("cst-cafe-logout", onLogout);
    return () => window.removeEventListener("cst-cafe-logout", onLogout);
  }, []);

  const login = useCallback(async (email, password, accountType = "customer") => {
    const path = accountType === "staff" ? "/staff/login" : "/auth/login";
    const data = await api(path, { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (details, accountType = "customer") => {
    const path = accountType === "staff" ? "/staff/signup" : "/auth/signup";
    const data = await api(path, { method: "POST", body: details });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

// For pages that need a login. Sends visitors to the right login page and
// brings them back here afterwards.
export function useRequireAuth(accountType = "customer") {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!auth.user && auth.user.accountType === accountType;

  useEffect(() => {
    if (auth.loading || allowed) return;
    const loginPage = accountType === "staff" ? "/staff/login" : "/login";
    router.replace(`${loginPage}?next=${encodeURIComponent(pathname)}`);
  }, [auth.loading, allowed, accountType, pathname, router]);

  return { ...auth, ready: !auth.loading && allowed };
}

// Where to go after logging in: the ?next= page if it's one of ours.
export function nextPath(fallback) {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
