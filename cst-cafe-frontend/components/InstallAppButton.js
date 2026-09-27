"use client";

// "Install app" button. Shows only when installing is possible:
// - Android / Chrome: opens the browser's install prompt
// - iPhone: explains Share → Add to Home Screen
// - already installed, or browser can't install: shows nothing

import { useState } from "react";
import { usePwaInstall } from "@/lib/usePwaInstall";

export default function InstallAppButton({ className = "" }) {
  const { canInstall, install, isInstalled, isIos } = usePwaInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isInstalled) return null;

  if (canInstall) {
    return (
      <button type="button" onClick={install} className={className}>
        Install app
      </button>
    );
  }

  if (isIos) {
    return (
      <div className="text-center">
        <button type="button" onClick={() => setShowIosHelp((v) => !v)} className={className}>
          Install app
        </button>
        {showIosHelp && (
          <p className="mt-2 max-w-xs text-xs text-muted">
            In Safari, tap the <span className="font-medium">Share</span> button (square with an
            arrow), then <span className="font-medium">Add to Home Screen</span>.
          </p>
        )}
      </div>
    );
  }

  return null;
}
