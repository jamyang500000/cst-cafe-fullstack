"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import ProfileMenu from "@/components/ProfileMenu";
import SettingsMenu from "@/components/SettingsMenu";
import { useAuth } from "@/lib/AuthContext";

const links = [
  { href: "/menu", label: "Menu" },
  { href: "/booking", label: "Book a table" },
  { href: "/orders", label: "My order" },
  { href: "/feedback", label: "Feedback" },
];

export default function CustomerNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isCustomer = user?.accountType === "customer";

  return (
    <header className="border-b border-border bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <Link href="/menu" className="font-display text-xl text-pine">
          CST Cafe
        </Link>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:px-0">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-pine text-paper"
                    : "text-foreground/70 hover:bg-card"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {loading ? null : isCustomer ? (
            <>
              <NotificationBell />
              <ProfileMenu user={user} profileHref="/profile" />
              <SettingsMenu logoutHref="/" />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-foreground/70 hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="rounded-full bg-pine px-4 py-1.5 text-sm text-paper transition-colors hover:opacity-90">
                Sign up
              </Link>
              <Link href="/staff/login" className="hidden text-sm text-muted hover:text-foreground sm:inline">
                Staff login
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}