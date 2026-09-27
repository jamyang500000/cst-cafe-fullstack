"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileMenu({ user, profileHref = "/profile" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const initials = getInitials(user.name);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Profile"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-pine text-xs font-medium text-paper hover:opacity-90 transition-opacity"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-paper shadow-lg z-50">
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pine text-sm font-medium text-paper">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
          </div>
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="block rounded-b-2xl px-4 py-3 text-sm text-foreground hover:bg-card transition-colors"
          >
            View profile
          </Link>
        </div>
      )}
    </div>
  );
}