"use client";
import { useEffect, useState } from "react";

// Shows an "Install app" button only when the browser fires
// beforeinstallprompt (i.e. the PWA is actually installable).
// If the event never fires, nothing is rendered — no broken button.
export default function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<Event | null>(null);
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferred) return;
    const promptEvent = deferred as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setOutcome(
      choice.outcome === "accepted"
        ? "App installed — look for U++ on your home screen."
        : "Install dismissed — you can install later from the browser menu."
    );
    setDeferred(null);
  }

  if (!deferred && !outcome) return null;
  return (
    <div className={className}>
      {deferred && (
        <button onClick={install} className="btn-brand !py-2.5 text-sm">
          📲 Install U++ app
        </button>
      )}
      {outcome && <p className="mt-2 text-sm font-semibold text-brand-dark">{outcome}</p>}
    </div>
  );
}
