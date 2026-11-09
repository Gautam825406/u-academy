"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FEATURES, FEATURE_KEYS, type Profile } from "@/lib/types";

type Row = Record<string, unknown>;
const TABLES: Record<string, string> = {
  batches: "batches", lectures: "lectures", materials: "materials", assignments: "assignments",
  tests: "tests", live_classes: "live_classes", doubts: "doubts", announcements: "announcements",
  notifications: "notifications", fees: "fees", attendance: "attendance", users: "profiles",
  reports: "batches", permissions: "role_permissions",
};
const CREATE_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  batches: [{ key: "name", label: "Batch name" }, { key: "class_label", label: "Class (e.g. Class 10)" }, { key: "board", label: "Board" }, { key: "subject", label: "Subject" }],
  lectures: [{ key: "title", label: "Lecture title" }, { key: "subject", label: "Subject" }, { key: "chapter", label: "Chapter" }, { key: "youtube_url", label: "YouTube URL" }, { key: "notes", label: "Notes" }],
  materials: [{ key: "title", label: "Material title" }, { key: "kind", label: "Kind (Notes / PYQ / Worksheet)" }, { key: "file_url", label: "File / link URL" }, { key: "description", label: "Description" }],
  assignments: [{ key: "title", label: "Assignment title" }, { key: "subject", label: "Subject" }, { key: "description", label: "Description" }, { key: "due_date", label: "Due date (YYYY-MM-DD)" }],
  tests: [{ key: "title", label: "Test title" }, { key: "subject", label: "Subject" }, { key: "total_marks", label: "Total marks" }, { key: "test_date", label: "Date (YYYY-MM-DD)" }],
  live_classes: [{ key: "title", label: "Live class title" }, { key: "subject", label: "Subject" }, { key: "meet_url", label: "Meet / Zoom link" }, { key: "starts_at", label: "Starts at (YYYY-MM-DD HH:MM)" }],
  doubts: [{ key: "question", label: "Your doubt / question" }],
  announcements: [{ key: "title", label: "Announcement title" }, { key: "body", label: "Message" }, { key: "audience", label: "Audience (all / students / parents / teachers)" }],
  fees: [{ key: "amount", label: "Amount (₹)" }, { key: "due_month", label: "Due month (e.g. November 2026)" }, { key: "status", label: "Status (pending / paid)" }],
  attendance: [{ key: "att_date", label: "Date (YYYY-MM-DD)" }, { key: "status", label: "Status (present / absent)" }],
};
const JUMP_TO = ["lectures","assignments","tests","live_classes","materials","attendance","fees","doubts"];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<string>("overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [perms, setPerms] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { loadProfile(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (profile) loadSection(section); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section, profile]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile((data as Profile) || null); setLoading(false);
    const tables = ["batches","lectures","assignments","tests","fees","doubts"];
    const c: Record<string, number> = {};
    for (const t of tables) { const { count } = await supabase.from(t).select("id", { count: "exact", head: true }); c[t] = count || 0; }
    setCounts(c);
    const { data: p } = await supabase.from("role_permissions").select("*").order("role").order("feature_key");
    setPerms((p as Row[]) || []);
  }
  async function loadSection(s: string) {
    const table = TABLES[s];
    if (!table || s === "overview" || s === "profile") { setRows([]); return; }
    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(50);
    if (error) setMsg(error.message); else setRows((data as Row[]) || []);
  }
  function isEnabled(key: string) {
    if (!profile) return false;
    if (profile.role === "admin") return true;
    const row = perms.find(p => p.role === profile.role && p.feature_key === key);
    return row ? Boolean(row.enabled) : true;
  }
  function isAdminOnly(key: string) { return key === "users" || key === "permissions"; }
  function openSection(key: string) { setSection(key); setDrawer(false); setMoreOpen(false); setMsg(""); window.scrollTo({ top: 0 }); }

  async function createRow(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const table = TABLES[section]; if (!table) return;
    const payload: Record<string, unknown> = { ...form };
    if (payload.total_marks) payload.total_marks = Number(payload.total_marks);
    if (payload.amount) payload.amount = Number(payload.amount);
    if (section === "doubts") payload.student_id = profile?.id;
    if (section === "fees") payload.student_id = profile?.id;
    if (section === "attendance") payload.student_id = profile?.id;
    payload.created_by = profile?.id;
    const { error } = await supabase.from(table).insert(payload);
    if (error) setMsg(error.message); else { setForm({}); setMsg("Saved."); loadSection(section); }
  }
  async function togglePerm(row: Row) {
    const { error } = await supabase.from("role_permissions").update({ enabled: !row.enabled }).eq("id", row.id as string);
    if (error) setMsg(error.message); else loadProfile();
  }
  async function toggleBlock(row: Row) {
    const { error } = await supabase.from("profiles").update({ is_blocked: !row.is_blocked }).eq("id", row.id as string);
    if (error) setMsg(error.message); else loadSection("users");
  }
  async function logout() { await supabase.auth.signOut(); router.push("/"); }

  if (loading) return <div className="p-8 font-bold">Loading your dashboard…</div>;
  if (!profile) return <div className="mx-auto max-w-xl p-8"><div className="card"><b>No profile found.</b><p className="mt-2 text-sm text-slate-600">Your login exists but no profile row was created. Register again, or ask an Admin to create your profile in Dashboard &gt; Users.</p><Link href="/auth/register" className="btn-brand mt-4">Register</Link></div></div>;

  const sidebar = (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <div className="mb-2 rounded-2xl bg-brand-tint p-3"><b className="block">{profile.full_name}</b><span className="text-xs font-bold capitalize text-brand-dark">{profile.role}{profile.class_label ? ` · ${profile.class_label}` : ""}{profile.board ? ` · ${profile.board}` : ""}</span><span className="mt-1 block text-xs text-slate-500">{profile.email}</span></div>
      <p className="px-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">All features · 15 sections</p>
      {["Main","Learning","Track & Support","Institute & Account"].map((group, gi) => (
        <div key={group}>
          <p className="mt-3 px-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{group}</p>
          {FEATURE_KEYS.filter((_, i) => Math.floor(i / 4) === gi || (gi === 3 && i >= 12)).map((key, idx) => {
            const i = FEATURE_KEYS.indexOf(key);
            const enabled = isEnabled(key);
            const adminOnly = isAdminOnly(key) && profile.role !== "admin";
            return (
              <button key={key} onClick={() => openSection(key)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${section===key ? "bg-brand-tint text-brand-dark" : "text-slate-600 hover:bg-slate-100"}`}>
                <span className="w-5 text-center">{["🏠","📚","▶","📄","✏","📝","📹","✓","₹","💬","🔔","📊","👥","🔐","👤"][i]}</span>
                <span className="flex-1">{FEATURES[i]}</span>
                {adminOnly && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">Admin</span>}
                {!enabled && !adminOnly && <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-extrabold text-accent-ink">Off</span>}
              </button>
            );
          })}
        </div>
      ))}
      <button onClick={logout} className="mt-4 rounded-xl border px-3 py-2.5 text-left text-sm font-bold text-red-700">Log out</button>
    </div>
  );

  const activeKey = FEATURE_KEYS[FEATURES.findIndex(f => f.toLowerCase().replace(/[^a-z]/g,"").includes(section.slice(0,4)))];
  const sectionEnabled = section === "overview" || section === "profile" || isEnabled(section);
  const sectionAdminOnly = isAdminOnly(section) && profile.role !== "admin";

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-white px-4 py-3">
        <button className="rounded-xl border px-3 py-2 font-bold md:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">☰ Menu</button>
        <Link href="/" className="flex items-center gap-2 font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">U++</span><span className="hidden sm:inline">U++ Academy</span></Link>
        <span className="ml-auto rounded-full bg-brand-tint px-3 py-1 text-xs font-extrabold capitalize text-brand-dark">{profile.role}</span>
        <button onClick={logout} className="hidden rounded-xl border px-3 py-2 text-sm font-bold md:block">Log out</button>
      </header>

      <div className="mx-auto flex max-w-7xl gap-5 px-4 py-5 pb-24 md:pb-5">
        <aside className="sticky top-[76px] hidden h-[calc(100vh-96px)] w-64 shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm md:block">{sidebar}</aside>
        <main className="min-w-0 flex-1">
          {msg && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{msg}</p>}
          {section === "overview" && (
            <div>
              <div className="rounded-3xl bg-gradient-to-r from-brand to-brand-dark p-6 text-white">
                <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Welcome back</p>
                <h1 className="mt-1 text-2xl font-extrabold">Namaste, {profile.full_name.split(" ")[0]} — {profile.role === "student" ? "your classes, lectures and tests are ready." : profile.role === "teacher" ? "your batches and evaluation queue are ready." : profile.role === "parent" ? "your child's progress is ready to check." : "the institute is ready to manage."}</h1>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[["Batches", counts.batches ?? 0],["Lectures", counts.lectures ?? 0],["Assignments", counts.assignments ?? 0],["Tests", counts.tests ?? 0]].map(([l,v]) => <div key={l as string} className="rounded-2xl bg-white/15 p-3"><b className="text-2xl">{v}</b><span className="block text-xs font-bold opacity-80">{l}</span></div>)}
                </div>
              </div>
              <h2 className="mb-3 mt-6 font-extrabold">Jump to</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {JUMP_TO.filter(k => isEnabled(k)).map(k => { const i = FEATURE_KEYS.indexOf(k as never); return <button key={k} onClick={() => openSection(k)} className="card !p-4 text-left font-bold hover:border-brand">{FEATURES[i]}</button>; })}
              </div>
              <div className="card mt-5"><h3 className="font-extrabold">Getting started</h3><p className="mt-1 text-sm text-slate-600">This academy starts empty. {profile.role === "admin" ? "Create your first batch in Batches, add teachers/students in Users, then publish lectures and assignments." : "Your Admin will add you to a batch. Once enrolled, lectures, assignments and tests appear here."} Fees are recorded manually in Fees &amp; Receipts — no online payment gateway yet.</p></div>
            </div>
          )}

          {section === "profile" && (
            <div className="card"><h2 className="text-xl font-extrabold">Profile</h2><dl className="mt-3 space-y-2 text-sm"><dt className="font-bold">Name</dt><dd>{profile.full_name}</dd><dt className="font-bold">Email</dt><dd>{profile.email}</dd><dt className="font-bold">Mobile</dt><dd>{profile.mobile || "—"}</dd><dt className="font-bold">Role</dt><dd className="capitalize">{profile.role}</dd>{profile.class_label && <><dt className="font-bold">Class</dt><dd>{profile.class_label} · {profile.board}</dd></>}{profile.subject && <><dt className="font-bold">Subject</dt><dd>{profile.subject}</dd></>}{profile.child_name && <><dt className="font-bold">Child</dt><dd>{profile.child_name} ({profile.child_student_id || "no link code"})</dd></>}{profile.institute_name && <><dt className="font-bold">Institute</dt><dd>{profile.institute_name}, {profile.city}</dd></>}</dl><p className="mt-3 text-sm text-slate-500">To change your role or reset a password, ask an Admin (Dashboard &gt; Users), or use Forgot password on the login page.</p></div>
          )}

          {section !== "overview" && section !== "profile" && (
            <div>
              {!sectionEnabled || sectionAdminOnly ? (
                <div className="card"><h2 className="text-xl font-extrabold">{FEATURES[FEATURE_KEYS.indexOf(section as never)] || section}</h2><p className="mt-2 text-sm text-slate-600">{sectionAdminOnly ? "This section is Admin-only." : "This feature is switched Off for your role. Ask an Admin to turn it on in Dashboard > Permissions."}</p></div>
              ) : section === "permissions" ? (
                <div className="card"><h2 className="text-xl font-extrabold">Role Permissions — 14 features</h2><p className="mt-1 text-sm text-slate-600">Admin only. Toggle a feature for a role. Students, teachers and parents will see disabled features tagged “Off” in their sidebar.</p>
                  <div className="mt-4 space-y-2">{perms.map(p => <div key={String(p.id)} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="font-bold capitalize">{String(p.role)} · {String(p.feature_key)}</span><button onClick={() => togglePerm(p)} disabled={profile.role!=="admin"} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${p.enabled ? "bg-brand text-white" : "bg-slate-200"}`}>{p.enabled ? "On" : "Off"}</button></div>)}</div>
                  {perms.length===0 && <p className="mt-3 text-sm text-slate-500">No permission rows yet — run supabase/schema.sql in your Supabase project, it seeds all 14 features × 4 roles.</p>}
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-extrabold capitalize">{FEATURES[FEATURE_KEYS.indexOf(section as never)] || section}</h2>
                  {CREATE_FIELDS[section] && (
                    <form onSubmit={createRow} className="card mt-3">
                      <h3 className="font-extrabold">Create new</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">{CREATE_FIELDS[section].map(f => <div key={f.key}><label className="label">{f.label}</label><input required={f.key!=="notes" && f.key!=="description"} className="input" value={form[f.key]||""} onChange={e=>setForm({...form,[f.key]:e.target.value})} /></div>)}</div>
                      <button className="btn-brand mt-3 !py-2.5 text-sm">Save</button>
                      <p className="mt-2 text-xs text-slate-500">For Fees, enter the student’s profile id in the app via Users first in a real deployment — this starter form records a fee against your own account as a placeholder; see README for the full Admin fee flow.</p>
                    </form>
                  )}
                  {section === "reports" && (
                    <div className="card mt-3"><h3 className="font-extrabold">Reports — live counts</h3><ul className="mt-2 space-y-1 text-sm text-slate-600"><li>Batches: {counts.batches ?? 0}</li><li>Lectures: {counts.lectures ?? 0}</li><li>Assignments: {counts.assignments ?? 0}</li><li>Tests: {counts.tests ?? 0}</li><li>Fees recorded: {counts.fees ?? 0}</li><li>Open doubts: {counts.doubts ?? 0}</li></ul><p className="mt-2 text-xs text-slate-500">Export: use Supabase Dashboard &gt; Table Editor &gt; Export CSV for any table.</p></div>
                  )}
                  <div className="mt-4 space-y-2">
                    {rows.length===0 && <div className="card text-sm text-slate-500">Nothing here yet — this academy starts empty. Create your first item above.</div>}
                    {rows.map(r => (
                      <div key={String(r.id)} className="card !p-4">
                        <b className="text-sm">{String(r.title || r.name || r.full_name || r.question || r.feature_key || r.id)}</b>
                        <p className="text-xs text-slate-500">{Object.entries(r).filter(([k])=>!["id","created_at","created_by"].includes(k)).slice(0,4).map(([k,v])=>`${k}: ${String(v ?? "")}`).join(" · ")}</p>
                        {section==="users" && <div className="mt-2 flex gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${(r as Row).is_blocked ? "bg-red-100 text-red-700" : "bg-brand-tint text-brand-dark"}`}>{(r as Row).is_blocked ? "Blocked" : "Active"}</span>{profile.role==="admin" && <button onClick={()=>toggleBlock(r)} className="rounded-lg border px-3 py-1 text-xs font-bold">{(r as Row).is_blocked ? "Unblock" : "Block"}</button>}</div>}
                        {section==="doubts" && (r as Row).status==="open" && profile.role!=="student" && <p className="mt-1 text-xs text-slate-500">Answer doubts from the Supabase table or the Admin panel — reply flow is in README (doubts.answer / status).</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile slide-in sidebar */}
      {drawer && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setDrawer(false)} /><aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl">{sidebar}</aside></div>}

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden">
        {["overview","batches","lectures","assignments"].map(k => { const i = FEATURE_KEYS.indexOf(k as never); const label = k==="overview" ? "Home" : FEATURES[i]; return <button key={k} onClick={()=>openSection(k)} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${section===k ? "text-brand" : "text-slate-400"}`}>{k==="overview"?"🏠":k==="batches"?"📚":k==="lectures"?"▶":"✏"}{label}</button>; })}
        <button onClick={()=>setMoreOpen(true)} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${moreOpen ? "text-brand" : "text-slate-400"}`}>⋯ More</button>
      </nav>

      {/* More sheet */}
      {moreOpen && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setMoreOpen(false)} /><div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-8"><div className="mb-3 flex items-center justify-between"><b>All sections</b><button onClick={()=>setMoreOpen(false)} className="rounded-lg border px-3 py-1 font-bold">Close</button></div><div className="grid grid-cols-3 gap-2">{FEATURE_KEYS.map((k,i)=>(<button key={k} onClick={()=>openSection(k)} className="rounded-2xl border p-3 text-center text-xs font-bold">{FEATURES[i]}{!isEnabled(k) && <span className="mt-1 block text-[10px] text-accent-ink">Off</span>}</button>))}</div><button onClick={logout} className="mt-4 w-full rounded-xl border py-3 font-bold text-red-700">Log out</button></div></div>}
    </div>
  );
}
