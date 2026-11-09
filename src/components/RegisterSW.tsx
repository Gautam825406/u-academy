"use client";
import { useEffect } from "react";

// Registers the U++ Academy service worker so the site is installable
// as a PWA (and can be packaged as an Android APK via PWABuilder).
// Checks for an updated worker on every load so a new deploy's worker
// (new cache version, new icons) activates instead of the old one.
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => reg.update().catch(() => {}))
        .catch((err) => console.warn("Service worker registration failed:", err));
    }
  }, []);
  return null;
}
