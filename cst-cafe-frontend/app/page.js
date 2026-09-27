"use client";

import Link from "next/link";
import CafeHeroScene from "../components/CafeHeroScene";
import InstallAppButton from "@/components/InstallAppButton";

export default function HomePage() {
  return (
    <main className="flex-1">
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-card via-paper to-amber/10 px-6 text-center">
        <CafeHeroScene className="pointer-events-none absolute inset-0 h-full w-full" />

        <div className="relative z-10 flex w-full max-w-md flex-col items-center">
          <p className="text-sm uppercase tracking-[0.2em] text-amber">
            Welcome to
          </p>
          <h1 className="mt-2 font-display text-5xl leading-tight text-pine sm:text-6xl">
            CST Cafe
          </h1>
          <p className="mt-4 text-muted">
            Order ahead, book a table, and skip the line. Log in or create an
            account to get started.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="rounded-full border border-pine px-6 py-2.5 text-sm font-medium text-pine hover:bg-pine/5 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-pine px-6 py-2.5 text-sm font-medium text-paper hover:bg-pine/90 transition-colors"
            >
              Sign up
            </Link>
          </div>

          <Link
            href="/menu"
            className="mt-6 text-sm text-muted hover:text-foreground hover:underline"
          >
            Just browsing? View the menu
          </Link>

          <InstallAppButton className="mt-6 rounded-full border border-amber/50 px-5 py-2 text-sm text-amber hover:bg-amber/10 transition-colors" />

          <Link
            href="/staff/login"
            className="mt-10 text-xs text-muted/70 hover:text-foreground"
          >
            Staff portal
          </Link>
        </div>

        <a
          href="#about"
          className="absolute bottom-8 z-10 flex flex-col items-center gap-1 text-xs text-muted/70 hover:text-foreground transition-colors"
        >
          About CST Cafe
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 animate-bounce"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </section>

      <section id="about" className="border-t border-border bg-paper px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-amber">About</p>
          <h2 className="mt-2 font-display text-3xl text-pine sm:text-4xl">
            Why we built CST Cafe
          </h2>
          <p className="mt-4 text-muted">
            CST Cafe gets crowded fast between classes, and the old
            pen-and-paper queue meant long waits just to place an order or
            grab a table. This project digitizes that whole experience —
            students and staff can browse the menu, order ahead, and reserve
            a table from their phone, while staff manage the kitchen queue
            and bookings from one dashboard. It&apos;s a capstone project for
            the BE Software Engineering programme at CST, built to make
            campus cafe life a little smoother for everyone.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="font-display text-lg text-pine">Order ahead</p>
              <p className="mt-2 text-sm text-muted">
                Browse today&apos;s menu and place your order before you even
                leave class, so it&apos;s ready when you arrive.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="font-display text-lg text-pine">Book a table</p>
              <p className="mt-2 text-sm text-muted">
                Reserve a spot in advance instead of hoping one&apos;s free
                during the lunch rush.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="font-display text-lg text-pine">Skip the queue</p>
              <p className="mt-2 text-sm text-muted">
                Track your order&apos;s status in real time and get notified
                the moment it&apos;s ready for pickup.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}