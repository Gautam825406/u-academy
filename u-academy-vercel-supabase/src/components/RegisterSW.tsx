"use client";
import { useEffect } from "react";

// Registers the U++ Academy service worker so the site is installable
// as a PWA (and can be packaged as an Android APK via PWABuilder).
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("Service worker registration failed:", err));
    }
  }, []);
  return null;
}
