"use client";

// Installing CST Cafe as an app.
//   const { canInstall, install, isInstalled, isIos } = usePwaInstall();
// - Android / desktop Chrome & Edge: the browser offers an install prompt,
//   which we keep and show when the user taps our "Install app" button.
// - iPhone (Safari): there's no prompt, so we show "Share → Add to Home Screen".

import { useEffect, useState } from "react";

let savedPrompt = null; // shared by every component on the page
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we'll show our own button instead
    savedPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    savedPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

export function usePwaInstall() {
  const [, rerender] = useState(0);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const update = () => rerender((n) => n + 1);
    listeners.add(update);
    setIsInstalled(
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
    );
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    return () => listeners.delete(update);
  }, []);

  async function install() {
    if (!savedPrompt) return false;
    savedPrompt.prompt();
    const { outcome } = await savedPrompt.userChoice;
    savedPrompt = null;
    listeners.forEach((fn) => fn());
    return outcome === "accepted";
  }

  return { canInstall: !!savedPrompt && !isInstalled, install, isInstalled, isIos };
}
