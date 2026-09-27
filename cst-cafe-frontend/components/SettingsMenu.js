"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredTheme, applyTheme } from "@/lib/theme";
import { useAuth } from "@/lib/AuthContext";

function GearIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export default function SettingsMenu({ logoutHref = "/" }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setIsDark(getStoredTheme() === "dark");
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    applyTheme(next);
    setIsDark(next === "dark");
  }

  function handleLogout() {
    logout();
    setOpen(false);
    router.push(logoutHref);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Settings"
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-card hover:text-foreground transition-colors"
      >
        <GearIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-paper shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-sm font-medium text-foreground">Settings</span>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <span className="text-sm text-foreground">
              {isDark ? "Dark mode" : "Light mode"}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDark}
              aria-label="Toggle dark mode"
              className={`flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors ${
                isDark ? "bg-pine justify-end" : "bg-border justify-start"
              }`}
            >
              <span className="h-5 w-5 rounded-full bg-white shadow" />
            </button>
          </div>

          <Link
            href="/setting/privacy"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 border-b border-border text-sm text-foreground hover:bg-card transition-colors"
          >
            Privacy settings
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-sm text-delayed hover:bg-card transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}