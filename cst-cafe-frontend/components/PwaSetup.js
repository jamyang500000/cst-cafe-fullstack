"use client";

// Registers the service worker (public/sw.js) so the site can be installed
// and shows an offline page without internet. Only in the real (production)
// build - in `npm run dev` it would get in the way of live reloading.

import { useEffect } from "react";

export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
