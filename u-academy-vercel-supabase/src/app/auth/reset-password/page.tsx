"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Shown after clicking the password-reset email link (via /auth/callback).
// The recovery session is already established by the callback, so
// updateUser sets the new password for the signed-in user.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setMsg("Passwords do not match.");
    if (password.length < 6) return setMsg("Password must be at least 6 characters.");
    setBusy(true); setMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Password updated. Redirecting to login…");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err: any) { setMsg(err.message || "Could not update password. Request a new reset link."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <Link href="/" className="font-extrabold">← U++ Academy</Link>
      <form onSubmit={submit} className="card mt-6">
        <h1 className="text-xl font-extrabold">Set a new password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter a new password for your Admin account, then sign in with it.</p>
        <div className="mt-4 space-y-3">
          <div><label className="label">New password</label><input required type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <div><label className="label">Confirm new password</label><input required type="password" className="input" value={confirm} onChange={e=>setConfirm(e.target.value)} /></div>
        </div>
        {msg && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{msg}</p>}
        <button disabled={busy} className="btn-brand mt-4 w-full">{busy ? "Updating…" : "Update password"}</button>
      </form>
    </div>
  );
}
