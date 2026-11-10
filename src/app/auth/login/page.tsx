"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BookOpen, Eye, EyeOff, GraduationCap,
  Loader2, Lock, Mail, MessagesSquare, TrendingUp, Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Show a clear message if a reset link failed (expired / already used).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "recovery_failed") {
      setMsg("That reset link did not work — it may have expired or already been used. Click 'Forgot password?' again to request a fresh link, and click it only once.");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const supabase = createClient();
      // Trim: a trailing space in the email (easy on a phone keyboard)
      // makes Supabase reject an otherwise correct login.
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
      // Self-heal: if this login has no profile row (old registration bug),
      // create it now — after signIn the session is valid, so RLS allows
      // inserting your own profile. First-ever profile becomes Admin.
      const userId = data.user?.id;
      if (userId) {
        const { data: prof } = await supabase.from("profiles").select("id").eq("id", userId).single();
        if (!prof) {
          const meta = (data.user?.user_metadata || {}) as Record<string, string>;
          const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
          await supabase.from("profiles").upsert({
            id: userId,
            full_name: meta.full_name || email.split("@")[0],
            email: cleanEmail, mobile: meta.mobile || "",
            role: count === 0 ? "admin" : (meta.role || "student"),
            class_label: meta.class_label || "Class 10", board: meta.board || "CBSE",
            subject: meta.subject || "", child_name: meta.child_name || "",
            child_student_id: meta.child_student_id || "",
            institute_name: meta.institute_name || "", city: meta.city || "",
          }, { onConflict: "id" });
        }
      }
      // Wait for the session to be stored (cookies flushed) before
      // leaving: navigating while the middleware still sees no session
      // used to bounce the student straight back to login right after
      // a successful sign-in. A full navigation also lets the middleware
      // refresh/validate the fresh session on the way in.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Signed in, but no session was stored — please try logging in again.");
      window.location.assign("/dashboard");
    } catch (err: any) { setMsg(err.message || "Login failed. Check your email and password."); }
    finally { setBusy(false); }
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const supabase = createClient();
      // Send the user to /auth/callback, which exchanges the emailed code
      // for a session and forwards recovery users to /auth/reset-password.
      // NEVER use localhost here — Supabase Site URL must be the live site.
      const origin = window.location.origin.includes("localhost")
        ? "https://u-academy-zeta.vercel.app"
        : window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin}/auth/callback` });
      if (error) throw error;
      setMsg("If that email is registered, a reset link was sent. An Admin can also reset your password from Dashboard > Users.");
    } catch (err: any) { setMsg(err.message || "Could not send reset link."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#172033]">
      {/* ---- Left branding panel (desktop only) ---- */}
      <aside aria-hidden="true" className="login-brand-panel login-fade relative hidden w-[46%] shrink-0 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-[#14B8A6]/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/logo.jpg" alt="" width={44} height={44} className="h-11 w-11 rounded-2xl object-cover shadow-lg ring-1 ring-white/40" />
          <span className="text-lg font-extrabold tracking-tight text-white">U++ Academy</span>
        </div>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/75">Learn. Practice. Achieve.</p>
          <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-[2.75rem]">
            Your Learning Journey Starts Here.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/85">
            Learn smarter, practice better and achieve your goals with U++ Academy.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            <div className="login-chip flex items-center gap-2.5 rounded-2xl bg-white/12 px-3.5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <Video className="h-5 w-5 shrink-0" /> Live Classes
            </div>
            <div className="login-chip-2 flex items-center gap-2.5 rounded-2xl bg-white/12 px-3.5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <BookOpen className="h-5 w-5 shrink-0" /> Daily Tests
            </div>
            <div className="login-chip-3 flex items-center gap-2.5 rounded-2xl bg-white/12 px-3.5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <MessagesSquare className="h-5 w-5 shrink-0" /> Doubt Forum
            </div>
            <div className="login-chip-4 flex items-center gap-2.5 rounded-2xl bg-white/12 px-3.5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <TrendingUp className="h-5 w-5 shrink-0" /> Marks &amp; Reports
            </div>
          </div>
        </div>
        <p className="relative flex items-center gap-2 text-sm font-medium text-white/75">
          <GraduationCap className="h-5 w-5" /> Classes 6–12 · CBSE · All subjects
        </p>
      </aside>

      {/* ---- Right form panel ---- */}
      <main className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-8 lg:py-0">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center lg:max-w-[420px]">
          <Link href="/" className="login-entrance mb-8 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#64748B] transition-colors hover:text-[#635BFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635BFF]">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>

          {/* Compact branding — mobile / tablet only */}
          <div className="login-entrance mb-6 flex items-center gap-3 lg:hidden">
            <img src="/logo.jpg" alt="U++ Academy" width={44} height={44} className="h-11 w-11 rounded-2xl object-cover shadow-md ring-1 ring-slate-200" />
            <div>
              <p className="text-base font-extrabold leading-tight tracking-tight">U++ Academy</p>
              <p className="text-xs font-semibold text-[#64748B]">Learn. Practice. Achieve.</p>
            </div>
          </div>

          <div className="login-entrance-delay rounded-3xl bg-white p-6 shadow-[0_20px_50px_-20px_rgba(23,32,51,0.18)] ring-1 ring-slate-100 sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">
              {forgot ? "Reset your password" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
              {forgot
                ? "Enter your registered email and we will send a reset link."
                : "Sign in to continue your learning journey."}
            </p>

            <form onSubmit={forgot ? reset : submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]" />
                  <input
                    id="login-email" required type="email" autoComplete="email" inputMode="email"
                    placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                    className="login-input w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-3.5 text-[15px] placeholder:text-slate-400"
                  />
                </div>
              </div>

              {!forgot && (
                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#64748B]" />
                    <input
                      id="login-password" required type={showPw ? "text" : "password"} autoComplete="current-password"
                      placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}
                      className="login-input w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-[15px] placeholder:text-slate-400"
                    />
                    <button
                      type="button" onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#64748B] transition-colors hover:bg-slate-100 hover:text-[#172033] focus-visible:outline-2 focus-visible:outline-[#635BFF]"
                    >
                      {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>
              )}

              <div aria-live="polite">
                {msg && <p className="login-msg rounded-xl bg-amber-50 px-3.5 py-3 text-sm font-medium leading-relaxed text-amber-800 ring-1 ring-amber-100">{msg}</p>}
              </div>

              <button
                type="submit" disabled={busy}
                className="login-btn flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635BFF]"
              >
                {busy ? (<><Loader2 className="h-5 w-5 animate-spin" /> Please wait…</>) : forgot ? "Send reset link" : (<>Login to my dashboard <ArrowRight className="h-[18px] w-[18px]" /></>)}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <button
                type="button" onClick={() => setForgot(!forgot)}
                className="font-semibold text-[#635BFF] transition-colors hover:text-[#5248e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635BFF]"
              >
                {forgot ? "Back to login" : "Forgot password?"}
              </button>
              <Link href="/auth/register" className="font-semibold text-[#635BFF] transition-colors hover:text-[#5248e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635BFF]">
                Create an account
              </Link>
            </div>
          </div>

          <p className="login-fade mt-5 text-center text-xs leading-relaxed text-[#64748B]">
            No demo logins — use the account you registered.
          </p>
        </div>
      </main>
    </div>
  );
}
