"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "student", label: "Student", desc: "Join your batch — lectures, assignments and tests." },
  { key: "teacher", label: "Teacher", desc: "Your batches, evaluation queue and attendance." },
  { key: "parent", label: "Parent", desc: "Link to your child — attendance, results and fees." },
  { key: "admin", label: "Admin", desc: "Run the institute — teachers, students, batches, fees." },
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [onboardNote, setOnboardNote] = useState("");
  const [f, setF] = useState({ full_name:"", email:"", mobile:"", password:"", confirm:"", class_label:"Class 10", board:"CBSE", subject:"Mathematics", child_name:"", child_student_id:"", institute_name:"", city:"" });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  // Onboarding state resolved from the DB: approved teacher request or Admin invite.
  // teacher_requests is public-readable, so it can be checked before sign-up.
  // onboarding_invites is authenticated-only, so it is re-checked after sign-up,
  // once the invitee has a session, before the profile row is written.
  async function checkOnboarding(supabase: ReturnType<typeof createClient>, email: string, afterSignup: boolean) {
    let forced: Role | null = null; let note = ""; let inv: Record<string, unknown> | null = null;
    let subject = ""; let class_label = ""; let board = "";
    try {
      const { data } = await supabase.from("teacher_requests").select("*").ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        if (data.status === "approved") { forced = "teacher"; note = "Your onboarding was approved by Admin — welcome! You are registering as a Teacher."; }
        else if (data.status === "pending") { note = "Your request is pending Admin approval — you can register now, Admin will confirm your teacher role."; }
        else if (data.status === "rejected") { note = "Your earlier teacher request was not approved. You can still register — Admin will review your role."; }
        if (data.subject) subject = String(data.subject);
      }
    } catch { /* RLS/network failure: registration still proceeds normally */ }
    if (afterSignup) {
      try {
        const { data } = await supabase.from("onboarding_invites").select("*").ilike("email", email).eq("status", "invited").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) {
          inv = data as Record<string, unknown>;
          forced = String(data.role) as Role;
          note = `Your onboarding was invited by Admin — welcome! You are registering as a ${forced}.`;
          if (data.subject) subject = String(data.subject);
          if (data.class_label) class_label = String(data.class_label);
          if (data.board) board = String(data.board);
        }
      } catch { /* ignore — registration still proceeds */ }
    }
    return { forced, note, inv, subject, class_label, board };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setMsg("Passwords do not match.");
    if (f.password.length < 6) return setMsg("Password must be at least 6 characters.");
    setBusy(true); setMsg("");
    try {
      const supabase = createClient();
      // Onboarding check (teacher request — public-readable before sign-up).
      const pre = await checkOnboarding(supabase, f.email.trim(), false);
      if (pre.note) setOnboardNote(pre.note);
      const chosenRole: Role = pre.forced || role;
      if (pre.forced) setRole(pre.forced);
      const chosenSubject = pre.subject || f.subject;
      // Pass profile fields as user_metadata so the DB trigger
      // (supabase/fix-profile-trigger.sql) creates the profile row
      // server-side even if the client insert below fails.
      const meta = {
        full_name: f.full_name, mobile: f.mobile, role: chosenRole,
        class_label: f.class_label, board: f.board, subject: chosenSubject,
        child_name: f.child_name, child_student_id: f.child_student_id,
        institute_name: f.institute_name, city: f.city,
      };
      let { data: auth, error } = await supabase.auth.signUp({
        email: f.email, password: f.password, options: { data: meta },
      });
      if (error && /already registered/i.test(error.message)) {
        // Login already exists (e.g. profile insert failed last time):
        // sign in with it instead of failing.
        const s = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (s.error) throw s.error;
        auth = s.data;
        error = null;
      }
      if (error) throw error;
      const userId = auth.user?.id;
      if (!userId) throw new Error("No user returned. Check Supabase Auth settings (email confirmations may require verification — see README).");
      // Invite check (authenticated-only table — now that the invitee has a
      // session). An Admin invite forces the invited role and its details.
      const post = await checkOnboarding(supabase, f.email.trim(), true);
      if (post.note) setOnboardNote(post.note);
      const invitedRole: Role | null = post.forced;
      if (invitedRole) setRole(invitedRole);
      const effectiveRole: Role = invitedRole || chosenRole;
      // Mark the invite as used so Admin sees it as registered.
      if (post.inv) {
        await supabase.from("onboarding_invites").update({ status: "registered" }).eq("id", String(post.inv.id));
      }
      // First user in the whole academy becomes Admin.
      // Note: the DB trigger already created the profile; this upsert is a
      // belt-and-braces retry so a missing profile is repaired on login.
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      const finalRole: Role = count === 0 ? "admin" : effectiveRole;
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: userId, full_name: f.full_name, email: f.email, mobile: f.mobile, role: finalRole,
        class_label: post.class_label || f.class_label, board: post.board || f.board, subject: post.subject || chosenSubject,
        child_name: f.child_name, child_student_id: f.child_student_id,
        institute_name: f.institute_name, city: f.city,
      }, { onConflict: "id" });
      if (pErr) {
        // Trigger should have created the row; warn but continue to dashboard
        // so the user is not stuck on the register page.
        console.warn("Profile upsert failed (trigger may have created it):", pErr.message);
      }
      if (finalRole === "admin" && effectiveRole !== "admin") setMsg("You are the first account, so you were made Admin. Redirecting…");
      router.push("/dashboard");
    } catch (err: any) { setMsg(err.message || "Registration failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/" className="font-extrabold">← U++ Academy</Link>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div><h1 className="text-3xl font-extrabold">Join U++ Academy</h1><p className="mt-2 text-slate-600">Create your account in a minute. One account opens the whole academy — classroom batches, the student app, tests and reports.</p>
        <ul className="mt-5 space-y-3 text-sm text-slate-600">{ROLES.map(r => <li key={r.key}><b>{r.label}s</b> — {r.desc}</li>)}</ul></div>
        <form onSubmit={submit} className="card">
          <h2 className="text-xl font-extrabold">Register</h2><p className="text-sm text-slate-500">First, tell us who is joining.</p>
          <div className="mt-4 grid grid-cols-4 gap-2">{ROLES.map(r => <button type="button" key={r.key} onClick={() => setRole(r.key)} className={`rounded-2xl border px-2 py-3 text-sm font-bold ${role===r.key ? "border-brand bg-brand-tint" : "bg-white"}`}>{r.label}</button>)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Full name</label><input required className="input" value={f.full_name} onChange={e=>set("full_name",e.target.value)} /></div>
            <div><label className="label">Email</label><input required type="email" className="input" value={f.email} onChange={e=>set("email",e.target.value)} /></div>
            <div><label className="label">Mobile number</label><input required className="input" value={f.mobile} onChange={e=>set("mobile",e.target.value)} /></div>
            {role==="student" && (<><div><label className="label">Class</label><select className="input" value={f.class_label} onChange={e=>set("class_label",e.target.value)}>{["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"].map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Board</label><select className="input" value={f.board} onChange={e=>set("board",e.target.value)}>{["CBSE","ICSE","State Board","Other"].map(c=><option key={c}>{c}</option>)}</select></div></>)}
            {role==="teacher" && (<><div><label className="label">Subject you teach</label><select className="input" value={f.subject} onChange={e=>set("subject",e.target.value)}>{["Mathematics","Science","Physics","Chemistry","Biology","English","Social Science","Accounts","Economics"].map(c=><option key={c}>{c}</option>)}</select></div></>)}
            {role==="parent" && (<><div><label className="label">Child&apos;s full name</label><input required className="input" value={f.child_name} onChange={e=>set("child_name",e.target.value)} /></div>
            <div><label className="label">Child&apos;s student ID / link code</label><input className="input" value={f.child_student_id} onChange={e=>set("child_student_id",e.target.value)} /></div></>)}
            {role==="admin" && (<><div><label className="label">Institute name</label><input className="input" value={f.institute_name} onChange={e=>set("institute_name",e.target.value)} /></div>
            <div><label className="label">City</label><input className="input" value={f.city} onChange={e=>set("city",e.target.value)} /></div></>)}
            <div><label className="label">Password</label><div className="relative"><input required type={showPw?"text":"password"} className="input pr-16" value={f.password} onChange={e=>set("password",e.target.value)} /><button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{showPw?"Hide":"Show"}</button></div></div>
            <div><label className="label">Confirm password</label><input required type={showPw?"text":"password"} className="input" value={f.confirm} onChange={e=>set("confirm",e.target.value)} /></div>
          </div>
          {onboardNote && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm font-semibold text-brand-dark">{onboardNote}</p>}
          {msg && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{msg}</p>}
          <button disabled={busy} className="btn-brand mt-4 w-full">{busy ? "Creating account…" : "Create account & open my dashboard"}</button>
          <p className="mt-3 text-center text-sm text-slate-500">Already registered? <Link href="/auth/login" className="font-bold text-brand">Login here</Link></p>
        </form>
      </div>
    </div>
  );
}
