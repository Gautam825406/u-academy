"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
            email, mobile: meta.mobile || "",
            role: count === 0 ? "admin" : (meta.role || "student"),
            class_label: meta.class_label || "Class 10", board: meta.board || "CBSE",
            subject: meta.subject || "", child_name: meta.child_name || "",
            child_student_id: meta.child_student_id || "",
            institute_name: meta.institute_name || "", city: meta.city || "",
          }, { onConflict: "id" });
        }
      }
      router.push("/dashboard"); router.refresh();
    } catch (err: any) { setMsg(err.message || "Login failed. Check your email and password."); }
    finally { setBusy(false); }
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/login` });
      if (error) throw error;
      setMsg("If that email is registered, a reset link was sent. An Admin can also reset your password from Dashboard > Users.");
    } catch (err: any) { setMsg(err.message || "Could not send reset link."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/" className="font-extrabold">← U++ Academy</Link>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div><h1 className="text-3xl font-extrabold">Welcome back</h1><p className="mt-2 text-slate-600">Your classroom is where you left it. Lectures resume mid-chapter, assignments remember their drafts, and parents see the latest marks — sign in with the role you registered with.</p>
        <p className="mt-4 rounded-xl bg-brand-tint p-3 text-sm font-semibold text-brand-dark">No demo logins here — this is a real app. Use the account you registered. The first account ever created is the Admin.</p></div>
        <form onSubmit={forgot ? reset : submit} className="card">
          <h2 className="text-xl font-extrabold">{forgot ? "Reset your password" : "Login"}</h2>
          <p className="text-sm text-slate-500">{forgot ? "Enter your registered email and we will send a reset link." : "Choose your role at registration — now just sign in."}</p>
          <div className="mt-4 space-y-3">
            <div><label className="label">Email</label><input required type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            {!forgot && <div><label className="label">Password</label><div className="relative"><input required type={showPw?"text":"password"} className="input pr-16" value={password} onChange={e=>setPassword(e.target.value)} /><button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{showPw?"Hide":"Show"}</button></div></div>}
          </div>
          {msg && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{msg}</p>}
          <button disabled={busy} className="btn-brand mt-4 w-full">{busy ? "Please wait…" : forgot ? "Send reset link" : "Login to my dashboard"}</button>
          <div className="mt-3 flex justify-between text-sm">
            <button type="button" onClick={()=>setForgot(!forgot)} className="font-bold text-brand">{forgot ? "Back to login" : "Forgot password?"}</button>
            <Link href="/auth/register" className="font-bold text-brand">Create an account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
