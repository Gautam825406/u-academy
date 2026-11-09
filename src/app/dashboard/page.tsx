"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FEATURES, FEATURE_KEYS, type Profile } from "@/lib/types";

type Row = Record<string, unknown>;
const s = (r: Row | null | undefined, k: string) => String((r as Row)?.[k] ?? "");
const n = (r: Row | null | undefined, k: string) => Number((r as Row)?.[k] ?? 0) || 0;
const JUMP_TO = ["lectures","assignments","tests","live_classes","materials","attendance","fees","doubts"];
function ytId(url: string) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<string>("overview");
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [perms, setPerms] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // section-specific state
  const [enrolBatch, setEnrolBatch] = useState("");
  const [enrolStudent, setEnrolStudent] = useState("");
  const [showEnrolled, setShowEnrolled] = useState("");
  const [subAns, setSubAns] = useState<Record<string, string>>({});
  const [subFile, setSubFile] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [testStu, setTestStu] = useState<Record<string, string>>({});
  const [testMarks, setTestMarks] = useState<Record<string, string>>({});
  const [testRem, setTestRem] = useState<Record<string, string>>({});
  const [attBatch, setAttBatch] = useState("");
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attMarks, setAttMarks] = useState<Record<string, string>>({});
  const [feeStu, setFeeStu] = useState("");
  const [feeBatch, setFeeBatch] = useState("");
  const [feeAmt, setFeeAmt] = useState("");
  const [feeMonth, setFeeMonth] = useState("");
  const [feeStatus, setFeeStatus] = useState("pending");
  const [doubtAns, setDoubtAns] = useState<Record<string, string>>({});
  const [annAud, setAnnAud] = useState("all");
  const [userRole, setUserRole] = useState<Record<string, string>>({});
  const [userChild, setUserChild] = useState<Record<string, string>>({});
  const [profEdit, setProfEdit] = useState<Record<string, string>>({});

  useEffect(() => { loadProfile(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (profile) loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section, profile]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    let { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!data) {
      const meta = (user.user_metadata || {}) as Record<string, string>;
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      await supabase.from("profiles").upsert({
        id: user.id, full_name: meta.full_name || user.email?.split("@")[0] || "User",
        email: user.email || "", mobile: meta.mobile || "",
        role: count === 0 ? "admin" : (meta.role || "student"),
        class_label: meta.class_label || "Class 10", board: meta.board || "CBSE",
        subject: meta.subject || "", child_name: meta.child_name || "",
        child_student_id: meta.child_student_id || "",
        institute_name: meta.institute_name || "", city: meta.city || "",
      }, { onConflict: "id" });
      const retry = await supabase.from("profiles").select("*").eq("id", user.id).single();
      data = retry.data;
    }
    setProfile((data as Profile) || null); setLoading(false);
    if (data) setProfEdit({ full_name: s(data, "full_name"), mobile: s(data, "mobile"), class_label: s(data, "class_label"), board: s(data, "board"), subject: s(data, "subject"), child_name: s(data, "child_name") });
  }

  async function loadAll() {
    const tables = ["batches","enrollments","lectures","materials","assignments","submissions","tests","test_results","live_classes","doubts","announcements","notifications","fees","attendance","profiles","role_permissions","enquiries"];
    const out: Record<string, Row[]> = {};
    for (const t of tables) {
      const { data: d } = await supabase.from(t).select("*").order("created_at", { ascending: false }).limit(200);
      out[t] = (d as Row[]) || [];
    }
    setData(out);
    setCounts({ batches: out.batches.length, lectures: out.lectures.length, assignments: out.assignments.length, tests: out.tests.length, fees: out.fees.length, doubts: out.doubts.filter(r => s(r, "status") === "open").length });
    setPerms(out.role_permissions);
  }

  const profiles = data.profiles || [];
  const batches = data.batches || [];
  const students = profiles.filter(p => s(p, "role") === "student");
  const teachers = profiles.filter(p => s(p, "role") === "teacher");
  const nameOf = (id: string) => s(profiles.find(p => s(p, "id") === id), "full_name") || id.slice(0, 8);
  const batchName = (id: string) => s(batches.find(b => s(b, "id") === id), "name") || "—";
  // Parent view: show the linked child's data, not the parent's own.
  const childProfile = profile?.role === "parent" && profile.child_student_id ? profiles.find(p => s(p, "id") === String(profile.child_student_id)) : null;
  const effectiveId = childProfile ? s(childProfile, "id") : (profile?.id || "");
  const effectiveName = childProfile ? s(childProfile, "full_name") : (profile?.full_name || "");
  const isStaff = profile?.role === "admin" || profile?.role === "teacher";
  const viewStudent = (r: Row) => isStaff || s(r, "student_id") === effectiveId;
  const viewUser = (r: Row) => isStaff || s(r, "user_id") === effectiveId || s(r, "user_id") === profile?.id;

  function isEnabled(key: string) {
    if (!profile) return false;
    if (profile.role === "admin") return true;
    const row = perms.find(p => p.role === profile.role && p.feature_key === key);
    return row ? Boolean(row.enabled) : true;
  }
  function isAdminOnly(key: string) { return key === "users" || key === "permissions"; }
  function openSection(key: string) { setSection(key); setDrawer(false); setMoreOpen(false); setMsg(""); window.scrollTo({ top: 0 }); }
  async function logout() { await supabase.auth.signOut(); router.push("/"); }
  async function togglePerm(row: Row) {
    const { error } = await supabase.from("role_permissions").update({ enabled: !row.enabled }).eq("id", row.id as string);
    if (error) setMsg(error.message); else loadAll();
  }
  async function toggleBlock(row: Row) {
    const { error } = await supabase.from("profiles").update({ is_blocked: !row.is_blocked }).eq("id", row.id as string);
    if (error) setMsg(error.message); else loadAll();
  }
  // ---- generic create (batches/lectures/materials/assignments/tests/live_classes) ----
  async function createRow(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const tableMap: Record<string, string> = { batches: "batches", lectures: "lectures", materials: "materials", assignments: "assignments", tests: "tests", live_classes: "live_classes" };
    const table = tableMap[section]; if (!table) return;
    const payload: Record<string, unknown> = { ...form };
    if (payload.total_marks) payload.total_marks = Number(payload.total_marks);
    if (payload.batch_id === "") payload.batch_id = null;
    if (payload.teacher_id === "") payload.teacher_id = null;
    if (payload.starts_at) payload.starts_at = new Date(String(payload.starts_at)).toISOString();
    if (section === "live_classes" && !payload.status) payload.status = "scheduled";
    payload.created_by = profile?.id;
    const { error } = await supabase.from(table).insert(payload);
    if (error) setMsg(error.message); else { setForm({}); setMsg("Saved."); loadAll(); }
  }
  async function enrol() {
    if (!enrolBatch || !enrolStudent) return setMsg("Pick a batch and a student to enrol.");
    const { error } = await supabase.from("enrollments").insert({ batch_id: enrolBatch, student_id: enrolStudent });
    if (error) setMsg(error.message); else { setMsg(`Enrolled ${nameOf(enrolStudent)} into ${batchName(enrolBatch)}.`); loadAll(); }
  }
  async function unenrol(batchId: string, studentId: string) {
    const { error } = await supabase.from("enrollments").delete().eq("batch_id", batchId).eq("student_id", studentId);
    if (error) setMsg(error.message); else loadAll();
  }
  // ---- assignments: submit + grade ----
  async function submitAssignment(aid: string) {
    const ans = subAns[aid] || ""; const file = subFile[aid] || "";
    if (!ans && !file) return setMsg("Write an answer or add a file link before submitting.");
    const { error } = await supabase.from("submissions").upsert({ assignment_id: aid, student_id: effectiveId, answer_text: ans, file_url: file, status: "submitted" }, { onConflict: "assignment_id,student_id" });
    if (error) setMsg(error.message); else { setMsg("Submission saved."); loadAll(); }
  }
  async function gradeSubmission(subId: string) {
    const g = grade[subId]; if (!g?.marks) return setMsg("Enter marks to grade.");
    const { error } = await supabase.from("submissions").update({ marks: Number(g.marks), feedback: g.feedback || "", status: "graded" }).eq("id", subId);
    if (error) setMsg(error.message); else { setMsg("Graded."); loadAll(); }
  }
  // ---- tests: enter marks ----
  async function enterMarks(testId: string) {
    const stu = testStu[testId]; const marks = testMarks[testId];
    if (!stu || !marks) return setMsg("Pick a student and enter marks.");
    const { error } = await supabase.from("test_results").upsert({ test_id: testId, student_id: stu, marks: Number(marks), remarks: testRem[testId] || "" }, { onConflict: "test_id,student_id" });
    if (error) setMsg(error.message); else { setMsg("Marks saved."); loadAll(); }
  }
  // ---- attendance roster ----
  function rosterStudents(batchId: string) {
    const enrolled = (data.enrollments || []).filter(e => s(e, "batch_id") === batchId).map(e => s(e, "student_id"));
    return enrolled.length ? students.filter(p => enrolled.includes(s(p, "id"))) : [];
  }
  async function saveAttendance() {
    if (!attBatch || !attDate) return setMsg("Pick a batch and a date.");
    const roster = rosterStudents(attBatch);
    if (!roster.length) return setMsg("No students enrolled in this batch yet — enrol students in Batches first.");
    for (const stu of roster) {
      const st = attMarks[s(stu, "id")] || "present";
      const { error } = await supabase.from("attendance").upsert({ batch_id: attBatch, student_id: s(stu, "id"), att_date: attDate, status: st, marked_by: profile?.id }, { onConflict: "batch_id,student_id,att_date" });
      if (error) { setMsg(error.message); return; }
    }
    setMsg(`Attendance saved for ${roster.length} students on ${attDate}.`); loadAll();
  }
  // ---- fees ----
  async function createFee(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!feeStu || !feeAmt) return setMsg("Pick a student and enter an amount.");
    const { count } = await supabase.from("fees").select("id", { count: "exact", head: true });
    const receipt = `U++-2026-${String((count || 0) + 1).padStart(4, "0")}`;
    const { error } = await supabase.from("fees").insert({ student_id: feeStu, batch_id: feeBatch || null, amount: Number(feeAmt), due_month: feeMonth || "", status: feeStatus, receipt_no: receipt, paid_at: feeStatus === "paid" ? new Date().toISOString() : null, created_by: profile?.id });
    if (error) setMsg(error.message); else { setMsg(`Fee saved. Receipt ${receipt}.`); setFeeAmt(""); setFeeMonth(""); loadAll(); }
  }
  async function markPaid(feeId: string) {
    const { error } = await supabase.from("fees").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", feeId);
    if (error) setMsg(error.message); else { setMsg("Marked as paid."); loadAll(); }
  }
  // ---- doubts ----
  async function askDoubt(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!form.question) return setMsg("Write your doubt first.");
    const { error } = await supabase.from("doubts").insert({ student_id: effectiveId, batch_id: form.batch_id || null, question: form.question });
    if (error) setMsg(error.message); else { setForm({}); setMsg("Doubt asked."); loadAll(); }
  }
  async function answerDoubt(did: string) {
    const ans = doubtAns[did]; if (!ans) return setMsg("Write an answer first.");
    const { error } = await supabase.from("doubts").update({ answer: ans, status: "answered" }).eq("id", did);
    if (error) setMsg(error.message); else { setMsg("Answer posted."); loadAll(); }
  }
  // ---- notifications / announcements ----
  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!form.title || !form.body) return setMsg("Title and message are required.");
    const { error } = await supabase.from("announcements").insert({ title: form.title, body: form.body, audience: annAud, created_by: profile?.id });
    if (error) { setMsg(error.message); return; }
    const targets = annAud === "all" ? profiles : profiles.filter(p => s(p, "role") === (annAud === "students" ? "student" : annAud === "parents" ? "parent" : annAud === "teachers" ? "teacher" : ""));
    for (const t of targets) await supabase.from("notifications").insert({ user_id: s(t, "id"), title: form.title, body: form.body });
    setForm({}); setMsg(`Announcement sent to ${targets.length} people.`); loadAll();
  }
  async function markRead(nid: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", nid); loadAll();
  }
  // ---- users admin ----
  async function changeRole(row: Row) {
    const role = userRole[s(row, "id")]; if (!role) return;
    const { error } = await supabase.from("profiles").update({ role }).eq("id", row.id as string);
    if (error) setMsg(error.message); else { setMsg(`${s(row, "full_name")} is now ${role}.`); loadAll(); }
  }
  async function linkChild(row: Row) {
    const child = userChild[s(row, "id")]; if (!child) return setMsg("Pick a student to link.");
    const { error } = await supabase.from("profiles").update({ child_student_id: child, child_name: nameOf(child) }).eq("id", row.id as string);
    if (error) setMsg(error.message); else { setMsg("Parent linked to child."); loadAll(); }
  }
  // ---- profile edit ----
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const { error } = await supabase.from("profiles").update({ full_name: profEdit.full_name, mobile: profEdit.mobile, class_label: profEdit.class_label, board: profEdit.board, subject: profEdit.subject, child_name: profEdit.child_name }).eq("id", profile?.id);
    if (error) setMsg(error.message); else { setMsg("Profile saved."); loadProfile(); }
  }
  // ---- reports CSV ----
  function downloadCSV() {
    const rows = reportRows();
    const head = "Student,Attendance %,Test average,Assignments submitted,Assignments graded,Fees paid (Rs),Fees pending (Rs)";
    const lines = rows.map(r => [r.name, r.attPct, r.testAvg, r.submitted, r.graded, r.feesPaid, r.feesPending].join(","));
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "u-academy-progress-report.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  function reportRows() {
    const who = profile?.role === "admin" || profile?.role === "teacher" ? students : students.filter(p => s(p, "id") === effectiveId);
    return who.map(stu => {
      const sid = s(stu, "id");
      const att = (data.attendance || []).filter(a => s(a, "student_id") === sid);
      const attPct = att.length ? Math.round(att.filter(a => s(a, "status") === "present").length / att.length * 100) : 0;
      const res = (data.test_results || []).filter(r => s(r, "student_id") === sid);
      const testAvg = res.length ? (res.reduce((t, r) => t + n(r, "marks"), 0) / res.length).toFixed(1) : "—";
      const subs = (data.submissions || []).filter(x => s(x, "student_id") === sid);
      const fees = (data.fees || []).filter(f => s(f, "student_id") === sid);
      return { name: s(stu, "full_name"), attPct: att.length ? `${attPct}%` : "—", testAvg, submitted: subs.length, graded: subs.filter(x => s(x, "status") === "graded").length, feesPaid: fees.filter(f => s(f, "status") === "paid").reduce((t, f) => t + n(f, "amount"), 0), feesPending: fees.filter(f => s(f, "status") === "pending").reduce((t, f) => t + n(f, "amount"), 0) };
    });
  }

  if (loading) return <div className="p-8 font-bold">Loading your dashboard…</div>;
  if (!profile) return <div className="mx-auto max-w-xl p-8"><div className="card"><b>No profile found.</b><p className="mt-2 text-sm text-slate-600">Your login exists but no profile row was created. Register again, or ask an Admin to create your profile in Dashboard &gt; Users.</p><Link href="/auth/register" className="btn-brand mt-4">Register</Link></div></div>;

  const sidebar = (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <div className="mb-2 rounded-2xl bg-brand-tint p-3"><b className="block">{profile.full_name}</b><span className="text-xs font-bold capitalize text-brand-dark">{profile.role}{profile.class_label ? ` · ${profile.class_label}` : ""}{profile.board ? ` · ${profile.board}` : ""}</span><span className="mt-1 block text-xs text-slate-500">{profile.email}</span>{childProfile && <span className="mt-1 block text-xs font-bold text-brand-dark">Viewing child: {effectiveName}</span>}</div>
      <p className="px-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">All features · 15 sections</p>
      {["Main","Learning","Track & Support","Institute & Account"].map((group, gi) => (
        <div key={group}>
          <p className="mt-3 px-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{group}</p>
          {FEATURE_KEYS.filter((_, i) => Math.floor(i / 4) === gi || (gi === 3 && i >= 12)).map((key) => {
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
  const sectionEnabled = section === "overview" || section === "profile" || isEnabled(section);
  const sectionAdminOnly = isAdminOnly(section) && profile.role !== "admin";
  const sel = (label: string, value: string, onChange: (v: string) => void, opts: { v: string; l: string }[], allLabel = "— pick —") => (
    <div><label className="label">{label}</label><select className="input" value={value} onChange={e => onChange(e.target.value)}><option value="">{allLabel}</option>{opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
  );
  return (
    <div className="min-h-screen">
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
          {childProfile && <p className="mb-3 rounded-xl bg-brand-tint p-3 text-sm font-bold text-brand-dark">Parent view — showing your child {effectiveName}&rsquo;s fees, attendance, tests and assignments below.</p>}
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
            <div className="card"><h2 className="text-xl font-extrabold">Profile</h2>
              <form onSubmit={saveProfile} className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label">Full name</label><input className="input" value={profEdit.full_name || ""} onChange={e => setProfEdit({ ...profEdit, full_name: e.target.value })} /></div>
                <div><label className="label">Mobile</label><input className="input" value={profEdit.mobile || ""} onChange={e => setProfEdit({ ...profEdit, mobile: e.target.value })} /></div>
                <div><label className="label">Class</label><input className="input" value={profEdit.class_label || ""} onChange={e => setProfEdit({ ...profEdit, class_label: e.target.value })} /></div>
                <div><label className="label">Board</label><input className="input" value={profEdit.board || ""} onChange={e => setProfEdit({ ...profEdit, board: e.target.value })} /></div>
                <div><label className="label">Subject (teachers)</label><input className="input" value={profEdit.subject || ""} onChange={e => setProfEdit({ ...profEdit, subject: e.target.value })} /></div>
                <div><label className="label">Child name (parents)</label><input className="input" value={profEdit.child_name || ""} onChange={e => setProfEdit({ ...profEdit, child_name: e.target.value })} /></div>
                <div className="sm:col-span-2"><button className="btn-brand !py-2.5 text-sm">Save profile</button></div>
              </form>
              <dl className="mt-4 space-y-1 text-sm text-slate-600"><dt className="font-bold text-slate-800">Email</dt><dd>{profile.email}</dd><dt className="font-bold text-slate-800">Role</dt><dd className="capitalize">{profile.role}</dd>{profile.institute_name && <><dt className="font-bold text-slate-800">Institute</dt><dd>{profile.institute_name}, {profile.city}</dd></>}{childProfile && <><dt className="font-bold text-slate-800">Linked child</dt><dd>{effectiveName}</dd></>}</dl>
              <p className="mt-3 text-sm text-slate-500">To change your role or reset a password, ask an Admin (Dashboard &gt; Users), or use Forgot password on the login page.</p>
            </div>
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
                  <h2 className="text-xl font-extrabold">{FEATURES[FEATURE_KEYS.indexOf(section as never)] || section}</h2>
                  {renderSection()}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {drawer && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setDrawer(false)} /><aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl">{sidebar}</aside></div>}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden">
        {["overview","batches","lectures","assignments"].map(k => { const i = FEATURE_KEYS.indexOf(k as never); const label = k==="overview" ? "Home" : FEATURES[i]; return <button key={k} onClick={()=>openSection(k)} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${section===k ? "text-brand" : "text-slate-400"}`}>{k==="overview"?"🏠":k==="batches"?"📚":k==="lectures"?"▶":"✏"}{label}</button>; })}
        <button onClick={()=>setMoreOpen(true)} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${moreOpen ? "text-brand" : "text-slate-400"}`}>⋯ More</button>
      </nav>
      {moreOpen && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setMoreOpen(false)} /><div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-8"><div className="mb-3 flex items-center justify-between"><b>All sections</b><button onClick={()=>setMoreOpen(false)} className="rounded-lg border px-3 py-1 font-bold">Close</button></div><div className="grid grid-cols-3 gap-2">{FEATURE_KEYS.map((k,i)=>(<button key={k} onClick={()=>openSection(k)} className="rounded-2xl border p-3 text-center text-xs font-bold">{FEATURES[i]}{!isEnabled(k) && <span className="mt-1 block text-[10px] text-accent-ink">Off</span>}</button>))}</div><button onClick={logout} className="mt-4 w-full rounded-xl border py-3 font-bold text-red-700">Log out</button></div></div>}
    </div>
  );

  // ---------- per-section renderers (defined after return for readability; hoisted function) ----------
  function renderSection() {
    const empty = (t: string) => <div className="card mt-3 text-sm text-slate-500">{t}</div>;
    if (section === "batches") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Create batch</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Batch name</label><input required className="input" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Class (e.g. Class 10)</label><input required className="input" value={form.class_label || ""} onChange={e => setForm({ ...form, class_label: e.target.value })} /></div>
          <div><label className="label">Board</label><input className="input" value={form.board || ""} onChange={e => setForm({ ...form, board: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          {sel("Teacher", form.teacher_id || "", v => setForm({ ...form, teacher_id: v }), teachers.map(t => ({ v: s(t, "id"), l: `${s(t, "full_name")} — ${s(t, "subject")}` })))}
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save batch</button></form>}
        {isStaff && <div className="card mt-3"><h3 className="font-extrabold">Enrol a student into a batch</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
          {sel("Batch", enrolBatch, setEnrolBatch, batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          {sel("Student", enrolStudent, setEnrolStudent, students.map(t => ({ v: s(t, "id"), l: `${s(t, "full_name")} (${s(t, "class_label")})` })))}
          <div className="flex items-end"><button onClick={enrol} className="btn-brand !py-2.5 text-sm">Enrol</button></div>
        </div></div>}
        <div className="mt-4 space-y-2">
          {batches.length === 0 && empty("No batches yet — create your first batch above.")}
          {batches.map(b => {
            const enrolled = (data.enrollments || []).filter(e => s(e, "batch_id") === s(b, "id"));
            return <div key={s(b, "id")} className="card !p-4"><b className="text-sm">{s(b, "name")}</b>
              <p className="text-xs text-slate-500">{s(b, "class_label")} · {s(b, "board")} · {s(b, "subject")} · Teacher: {s(b, "teacher_id") ? nameOf(s(b, "teacher_id")) : "—"} · {enrolled.length} enrolled</p>
              <button onClick={() => setShowEnrolled(showEnrolled === s(b, "id") ? "" : s(b, "id"))} className="mt-2 rounded-lg border px-3 py-1 text-xs font-bold">{showEnrolled === s(b, "id") ? "Hide students" : "Show enrolled students"}</button>
              {showEnrolled === s(b, "id") && <ul className="mt-2 space-y-1 text-sm">{enrolled.length === 0 ? <li className="text-slate-500">Nobody enrolled yet.</li> : enrolled.map(e => <li key={s(e, "id")} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{nameOf(s(e, "student_id"))}</span>{isStaff && <button onClick={() => unenrol(s(b, "id"), s(e, "student_id"))} className="text-xs font-bold text-red-700">Remove</button>}</li>)}</ul>}
            </div>;
          })}
        </div>
      </div>
    );
    if (section === "lectures") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Add lecture</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Lecture title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Chapter</label><input className="input" value={form.chapter || ""} onChange={e => setForm({ ...form, chapter: e.target.value })} /></div>
          <div><label className="label">YouTube URL</label><input className="input" value={form.youtube_url || ""} onChange={e => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></div>
          <div><label className="label">Notes</label><input className="input" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save lecture</button></form>}
        <div className="mt-4 space-y-2">
          {(data.lectures || []).length === 0 && empty("No lectures yet.")}
          {(data.lectures || []).map(l => { const id = ytId(s(l, "youtube_url")); return <div key={s(l, "id")} className="card !p-4"><b className="text-sm">{s(l, "title")}</b><p className="text-xs text-slate-500">{batchName(s(l, "batch_id"))} · {s(l, "subject")} · {s(l, "chapter")}</p>
            {id ? <div className="mt-2 aspect-video w-full max-w-xl overflow-hidden rounded-xl"><iframe className="h-full w-full" src={`https://www.youtube.com/embed/${id}`} title={s(l, "title")} allowFullScreen /></div> : s(l, "youtube_url") ? <a className="mt-2 inline-block text-sm font-bold text-brand-dark underline" href={s(l, "youtube_url")} target="_blank" rel="noreferrer">▶ Watch on YouTube</a> : null}
            {s(l, "notes") && <p className="mt-2 text-sm text-slate-600">{s(l, "notes")}</p>}</div>; })}
        </div>
      </div>
    );
    if (section === "materials") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Add study material</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          {sel("Kind", form.kind || "", v => setForm({ ...form, kind: v }), [{ v: "Notes", l: "Notes" }, { v: "PYQ", l: "PYQ" }, { v: "Worksheet", l: "Worksheet" }, { v: "E-book", l: "E-book" }])}
          <div><label className="label">File / link URL</label><input className="input" value={form.file_url || ""} onChange={e => setForm({ ...form, file_url: e.target.value })} placeholder="https://… (PDF / Drive link)" /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><input className="input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save material</button></form>}
        <div className="mt-4 space-y-2">
          {(data.materials || []).length === 0 && empty("No materials yet.")}
          {(data.materials || []).map(m => <div key={s(m, "id")} className="card !p-4"><b className="text-sm">{s(m, "title")}</b><p className="text-xs text-slate-500">{batchName(s(m, "batch_id"))} · {s(m, "kind")}</p>{s(m, "description") && <p className="mt-1 text-sm text-slate-600">{s(m, "description")}</p>}{s(m, "file_url") && <a className="mt-2 inline-block text-sm font-bold text-brand-dark underline" href={s(m, "file_url")} target="_blank" rel="noreferrer">Open file ↗</a>}</div>)}
        </div>
      </div>
    );
    if (section === "assignments") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Create assignment</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Due date</label><input type="date" className="input" value={form.due_date || ""} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><input className="input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save assignment</button></form>}
        <div className="mt-4 space-y-2">
          {(data.assignments || []).length === 0 && empty("No assignments yet.")}
          {(data.assignments || []).map(a => {
            const aid = s(a, "id");
            const subs = (data.submissions || []).filter(x => s(x, "assignment_id") === aid);
            const mine = subs.find(x => s(x, "student_id") === effectiveId);
            const visibleSubs = isStaff ? subs : mine ? [mine] : [];
            return <div key={aid} className="card !p-4"><b className="text-sm">{s(a, "title")}</b><p className="text-xs text-slate-500">{batchName(s(a, "batch_id"))} · {s(a, "subject")} · Due {s(a, "due_date") || "—"}</p>{s(a, "description") && <p className="mt-1 text-sm text-slate-600">{s(a, "description")}</p>}
              {!isStaff && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">{mine ? `Your submission: ${s(mine, "status")}${mine.marks != null ? ` · ${String(mine.marks)} marks` : ""}${s(mine, "feedback") ? ` · ${s(mine, "feedback")}` : ""}` : "You have not submitted this yet."}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2"><input className="input" placeholder="Your answer" value={subAns[aid] || ""} onChange={e => setSubAns({ ...subAns, [aid]: e.target.value })} /><input className="input" placeholder="File link (optional)" value={subFile[aid] || ""} onChange={e => setSubFile({ ...subFile, [aid]: e.target.value })} /></div>
                <button onClick={() => submitAssignment(aid)} className="btn-brand mt-2 !py-2 text-xs">Submit{ mine ? " again" : ""}</button></div>}
              {isStaff && <div className="mt-3 space-y-2">{subs.length === 0 ? <p className="text-xs text-slate-500">No submissions yet.</p> : subs.map(x => { const xid = s(x, "id"); const g = grade[xid] || { marks: String(x.marks ?? ""), feedback: s(x, "feedback") }; return <div key={xid} className="rounded-xl border p-3 text-sm"><b>{nameOf(s(x, "student_id"))}</b> — {s(x, "status")}{x.marks != null ? ` · ${String(x.marks)} marks` : ""}<p className="text-slate-600">{s(x, "answer_text")}</p>{s(x, "file_url") && <a className="text-brand-dark underline" href={s(x, "file_url")} target="_blank" rel="noreferrer">Submitted file ↗</a>}
                <div className="mt-2 grid gap-2 sm:grid-cols-3"><input className="input" type="number" placeholder="Marks" value={g.marks} onChange={e => setGrade({ ...grade, [xid]: { ...g, marks: e.target.value } })} /><input className="input sm:col-span-2" placeholder="Feedback" value={g.feedback} onChange={e => setGrade({ ...grade, [xid]: { ...g, feedback: e.target.value } })} /></div>
                <button onClick={() => gradeSubmission(xid)} className="btn-brand mt-2 !py-2 text-xs">Save grade</button></div>; })}</div>}
            </div>;
          })}
        </div>
      </div>
    );
    if (section === "tests") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Create test</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Test title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Total marks</label><input type="number" className="input" value={form.total_marks || ""} onChange={e => setForm({ ...form, total_marks: e.target.value })} /></div>
          <div><label className="label">Test date</label><input type="date" className="input" value={form.test_date || ""} onChange={e => setForm({ ...form, test_date: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save test</button></form>}
        <div className="mt-4 space-y-2">
          {(data.tests || []).length === 0 && empty("No tests yet.")}
          {(data.tests || []).map(t => {
            const tid = s(t, "id");
            const results = (data.test_results || []).filter(r => s(r, "test_id") === tid);
            const avg = results.length ? (results.reduce((a, r) => a + n(r, "marks"), 0) / results.length).toFixed(1) : "—";
            const mine = results.find(r => s(r, "student_id") === effectiveId);
            const visible = isStaff ? results : mine ? [mine] : [];
            return <div key={tid} className="card !p-4"><b className="text-sm">{s(t, "title")}</b><p className="text-xs text-slate-500">{batchName(s(t, "batch_id"))} · {s(t, "subject")} · Total {String(t.total_marks ?? "")} · {s(t, "test_date")} · Class average: {avg}</p>
              {isStaff && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">Enter marks per student</p><div className="mt-2 grid gap-2 sm:grid-cols-4">
                {sel("Student", testStu[tid] || "", v => setTestStu({ ...testStu, [tid]: v }), students.map(x => ({ v: s(x, "id"), l: s(x, "full_name") })))}
                <div><label className="label">Marks</label><input type="number" className="input" value={testMarks[tid] || ""} onChange={e => setTestMarks({ ...testMarks, [tid]: e.target.value })} /></div>
                <div><label className="label">Remarks</label><input className="input" value={testRem[tid] || ""} onChange={e => setTestRem({ ...testRem, [tid]: e.target.value })} /></div>
                <div className="flex items-end"><button onClick={() => enterMarks(tid)} className="btn-brand !py-2.5 text-xs">Save marks</button></div></div></div>}
              <ul className="mt-2 space-y-1 text-sm">{visible.length === 0 ? <li className="text-slate-500">{isStaff ? "No results entered yet." : "Your result is not entered yet."}</li> : visible.map(r => <li key={s(r, "id")} className="rounded-lg bg-slate-50 px-3 py-2">{nameOf(s(r, "student_id"))} — <b>{String(r.marks ?? "—")} / {String(t.total_marks ?? "")}</b>{s(r, "remarks") ? ` · ${s(r, "remarks")}` : ""}</li>)}</ul>
            </div>;
          })}
        </div>
      </div>
    );
    if (section === "live_classes") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Schedule live class</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Meet / Zoom link</label><input className="input" value={form.meet_url || ""} onChange={e => setForm({ ...form, meet_url: e.target.value })} placeholder="https://meet.google.com/…" /></div>
          <div><label className="label">Starts at</label><input type="datetime-local" className="input" value={form.starts_at || ""} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
          {sel("Status", form.status || "scheduled", v => setForm({ ...form, status: v }), [{ v: "scheduled", l: "Scheduled" }, { v: "live", l: "Live now" }])}
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save live class</button></form>}
        <div className="mt-4 space-y-2">
          {(data.live_classes || []).length === 0 && empty("No live classes scheduled yet.")}
          {(data.live_classes || []).map(c => <div key={s(c, "id")} className="card !p-4"><b className="text-sm">{s(c, "title")}</b><p className="text-xs text-slate-500">{batchName(s(c, "batch_id"))} · {s(c, "subject")} · {s(c, "starts_at") ? new Date(s(c, "starts_at")).toLocaleString() : "—"}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${s(c, "status") === "live" ? "bg-red-100 text-red-700" : "bg-brand-tint text-brand-dark"}`}>{s(c, "status") === "live" ? "● Live now" : "Scheduled"}</span>{s(c, "meet_url") && <div><a href={s(c, "meet_url")} target="_blank" rel="noreferrer" className="btn-brand mt-2 inline-block !py-2 text-xs">Join class ↗</a></div>}</div>)}
        </div>
      </div>
    );
    if (section === "attendance") return (
      <div>
        {isStaff ? <div className="card mt-3"><h3 className="font-extrabold">Mark attendance — full roster</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
          {sel("Batch", attBatch, setAttBatch, batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Date</label><input type="date" className="input" value={attDate} onChange={e => setAttDate(e.target.value)} /></div>
          <div className="flex items-end"><button onClick={() => { const r = rosterStudents(attBatch); const m: Record<string, string> = {}; r.forEach(x => { m[s(x, "id")] = "present"; }); setAttMarks(m); setMsg(r.length ? `Roster loaded: ${r.length} students.` : "No students enrolled in this batch yet."); }} className="btn-brand !py-2.5 text-sm">Load roster</button></div>
        </div>
        {attBatch && rosterStudents(attBatch).length === 0 && <p className="mt-3 text-sm text-slate-500">No students enrolled in this batch yet — enrol students in Batches first.</p>}
        {attBatch && rosterStudents(attBatch).length > 0 && <div className="mt-3 space-y-2">{rosterStudents(attBatch).map(stu => { const sid = s(stu, "id"); return <div key={sid} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="font-bold">{s(stu, "full_name")} <span className="font-normal text-slate-500">({s(stu, "class_label")})</span></span><span className="flex gap-2"><button onClick={() => setAttMarks({ ...attMarks, [sid]: "present" })} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${(attMarks[sid] || "present") === "present" ? "bg-brand text-white" : "bg-slate-200"}`}>Present</button><button onClick={() => setAttMarks({ ...attMarks, [sid]: "absent" })} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${attMarks[sid] === "absent" ? "bg-red-600 text-white" : "bg-slate-200"}`}>Absent</button></span></div>; })}</div>}
        {attBatch && rosterStudents(attBatch).length > 0 && <button onClick={saveAttendance} className="btn-brand mt-3 !py-2.5 text-sm">Save attendance for all</button>}
        </div> : <div className="card mt-3"><h3 className="font-extrabold">Your attendance</h3><ul className="mt-2 space-y-1 text-sm">{(data.attendance || []).filter(a => s(a, "student_id") === effectiveId).length === 0 ? <li className="text-slate-500">No attendance recorded yet.</li> : (data.attendance || []).filter(a => s(a, "student_id") === effectiveId).map(a => <li key={s(a, "id")} className="rounded-lg bg-slate-50 px-3 py-2">{s(a, "att_date")} — {batchName(s(a, "batch_id"))} — <b className="capitalize">{s(a, "status")}</b></li>)}</ul><p className="mt-2 text-sm font-bold">Attendance: {reportRows().find(r => r.name === effectiveName)?.attPct || "—"}</p></div>}
      </div>
    );
    if (section === "fees") return (
      <div>
        {profile?.role === "admin" && <form onSubmit={createFee} className="card mt-3"><h3 className="font-extrabold">Create fee (Admin)</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Student", feeStu, setFeeStu, students.map(x => ({ v: s(x, "id"), l: `${s(x, "full_name")} (${s(x, "class_label")})` })))}
          {sel("Batch", feeBatch, setFeeBatch, batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Amount (₹)</label><input required type="number" className="input" value={feeAmt} onChange={e => setFeeAmt(e.target.value)} /></div>
          <div><label className="label">Due month (e.g. November 2026)</label><input className="input" value={feeMonth} onChange={e => setFeeMonth(e.target.value)} /></div>
          {sel("Status", feeStatus, setFeeStatus, [{ v: "pending", l: "Pending" }, { v: "paid", l: "Paid" }])}
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save fee — receipt auto-generated (U++-2026-XXXX)</button></form>}
        {(() => { const list = (data.fees || []).filter(f => viewStudent(f)); const collected = list.filter(f => s(f, "status") === "paid").reduce((t, f) => t + n(f, "amount"), 0); const pending = list.filter(f => s(f, "status") === "pending").reduce((t, f) => t + n(f, "amount"), 0); return <div><div className="mt-3 grid grid-cols-2 gap-3"><div className="card !p-4"><b className="text-xl">₹{collected}</b><span className="block text-xs font-bold text-slate-500">Collected</span></div><div className="card !p-4"><b className="text-xl">₹{pending}</b><span className="block text-xs font-bold text-slate-500">Pending</span></div></div>
        <div className="mt-4 space-y-2">{list.length === 0 && empty("No fees recorded yet.")}{list.map(f => <div key={s(f, "id")} className="card !p-4"><b className="text-sm">₹{String(f.amount)} — {nameOf(s(f, "student_id"))}</b><p className="text-xs text-slate-500">Receipt {s(f, "receipt_no") || "—"} · {batchName(s(f, "batch_id"))} · Due {s(f, "due_month")} · {s(f, "paid_at") ? `Paid ${new Date(s(f, "paid_at")).toLocaleDateString()}` : "Not paid"}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${s(f, "status") === "paid" ? "bg-brand-tint text-brand-dark" : "bg-amber-100 text-amber-800"}`}>{s(f, "status")}</span>{profile?.role === "admin" && s(f, "status") === "pending" && <button onClick={() => markPaid(s(f, "id"))} className="btn-brand ml-2 !py-1.5 text-xs">Mark as paid</button>}</div>)}</div></div>; })()}
      </div>
    );
    if (section === "doubts") return (
      <div>
        <form onSubmit={askDoubt} className="card mt-3"><h3 className="font-extrabold">Ask a doubt</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Your doubt / question</label><input required className="input" value={form.question || ""} onChange={e => setForm({ ...form, question: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Ask</button></form>
        <div className="mt-4 space-y-2">
          {(data.doubts || []).filter(d => isStaff || s(d, "student_id") === effectiveId).length === 0 && empty("No doubts yet.")}
          {(data.doubts || []).filter(d => isStaff || s(d, "student_id") === effectiveId).map(d => { const did = s(d, "id"); return <div key={did} className="card !p-4"><b className="text-sm">{s(d, "question")}</b><p className="text-xs text-slate-500">{nameOf(s(d, "student_id"))} · {batchName(s(d, "batch_id"))} · {s(d, "status")}</p>
            {s(d, "answer") ? <p className="mt-2 rounded-xl bg-brand-tint p-3 text-sm"><b>Answer:</b> {s(d, "answer")}</p> : <p className="mt-2 text-sm text-slate-500">Not answered yet.</p>}
            {isStaff && <div className="mt-2"><textarea className="input" rows={2} placeholder="Write your answer here…" value={doubtAns[did] || ""} onChange={e => setDoubtAns({ ...doubtAns, [did]: e.target.value })} /><button onClick={() => answerDoubt(did)} className="btn-brand mt-2 !py-2 text-xs">Post answer</button></div>}
          </div>; })}
        </div>
      </div>
    );
    if (section === "notifications") return (
      <div>
        {isStaff && <form onSubmit={createAnnouncement} className="card mt-3"><h3 className="font-extrabold">Send announcement</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          {sel("Audience", annAud, setAnnAud, [{ v: "all", l: "Everyone" }, { v: "students", l: "Students" }, { v: "parents", l: "Parents" }, { v: "teachers", l: "Teachers" }])}
          <div className="sm:col-span-2"><label className="label">Message</label><input required className="input" value={form.body || ""} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Send announcement</button><p className="mt-2 text-xs text-slate-500">This also creates a notification for each person in the audience.</p></form>}
        <h3 className="mt-5 font-extrabold">Announcements</h3>
        <div className="mt-2 space-y-2">{(data.announcements || []).length === 0 && empty("No announcements yet.")}{(data.announcements || []).map(a => <div key={s(a, "id")} className="card !p-4"><b className="text-sm">{s(a, "title")}</b><p className="text-sm text-slate-600">{s(a, "body")}</p><p className="text-xs text-slate-500">Audience: {s(a, "audience")}</p></div>)}</div>
        <h3 className="mt-5 font-extrabold">Your notifications</h3>
        <div className="mt-2 space-y-2">{(data.notifications || []).filter(nt => viewUser(nt)).length === 0 && empty("No notifications for you yet.")}{(data.notifications || []).filter(nt => viewUser(nt)).map(nt => <div key={s(nt, "id")} className="card !p-4"><b className="text-sm">{s(nt, "title")}</b><p className="text-sm text-slate-600">{s(nt, "body")}</p>{!nt.is_read ? <button onClick={() => markRead(s(nt, "id"))} className="mt-2 rounded-lg border px-3 py-1 text-xs font-bold">Mark as read</button> : <span className="mt-2 inline-block text-xs font-bold text-brand-dark">✓ Read</span>}</div>)}</div>
      </div>
    );
    if (section === "users") return (
      <div className="mt-4 space-y-2">
        <p className="card mt-3 text-sm text-slate-600">Admin only. New accounts are created by the user registering (there is no admin password reset from this panel — use Forgot password on the login page). Here you can change roles, block/unblock, link a parent to a child, and see each user&rsquo;s batch enrolments.</p>
        {profiles.length === 0 && empty("No users yet.")}
        {profiles.map(u => { const uid = s(u, "id"); const enrols = (data.enrollments || []).filter(e => s(e, "student_id") === uid); return <div key={uid} className="card !p-4"><b className="text-sm">{s(u, "full_name")}</b><p className="text-xs text-slate-500">{s(u, "email")} · {s(u, "mobile")} · {s(u, "class_label")} {s(u, "board")} · {s(u, "subject")} · Enrolled in: {enrols.length ? enrols.map(e => batchName(s(e, "batch_id"))).join(", ") : "—"}{s(u, "role") === "parent" && s(u, "child_student_id") ? ` · Child: ${nameOf(s(u, "child_student_id"))}` : ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${u.is_blocked ? "bg-red-100 text-red-700" : "bg-brand-tint text-brand-dark"}`}>{u.is_blocked ? "Blocked" : "Active"}</span>
          <button onClick={() => toggleBlock(u)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">{u.is_blocked ? "Unblock" : "Block"}</button>
          {sel("Role", userRole[uid] || s(u, "role"), v => setUserRole({ ...userRole, [uid]: v }), [{ v: "student", l: "Student" }, { v: "teacher", l: "Teacher" }, { v: "parent", l: "Parent" }, { v: "admin", l: "Admin" }])}
          <button onClick={() => changeRole(u)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Change role</button></div>
          {s(u, "role") === "parent" && <div className="mt-2 flex flex-wrap items-center gap-2">{sel("Link child student", userChild[uid] || "", v => setUserChild({ ...userChild, [uid]: v }), students.map(x => ({ v: s(x, "id"), l: s(x, "full_name") })))}<button onClick={() => linkChild(u)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Link parent → child</button></div>}
        </div>; })}
      </div>
    );
    if (section === "reports") return (
      <div>
        <div className="card mt-3"><h3 className="font-extrabold">Per-student progress{childProfile ? ` — ${effectiveName}` : ""}</h3>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="text-xs uppercase text-slate-400"><th className="py-2">Student</th><th>Attendance</th><th>Test avg</th><th>Submitted</th><th>Graded</th><th>Fees paid</th><th>Fees pending</th></tr></thead><tbody>
          {reportRows().length === 0 ? <tr><td className="py-2 text-slate-500" colSpan={7}>No students yet.</td></tr> : reportRows().map(r => <tr key={r.name} className="border-t"><td className="py-2 font-bold">{r.name}</td><td>{r.attPct}</td><td>{r.testAvg}</td><td>{r.submitted}</td><td>{r.graded}</td><td>₹{r.feesPaid}</td><td>₹{r.feesPending}</td></tr>)}
          </tbody></table></div>
          <button onClick={downloadCSV} className="btn-brand mt-3 !py-2.5 text-sm">Download CSV report</button>
        </div>
        <div className="card mt-3"><h3 className="font-extrabold">Enquiries (from the landing-page demo form)</h3>
          <div className="mt-2 space-y-2">{(data.enquiries || []).length === 0 && <p className="text-sm text-slate-500">No enquiries yet.</p>}{(data.enquiries || []).map(q => <div key={s(q, "id")} className="rounded-xl border p-3 text-sm"><b>{s(q, "student_name")}</b> — {s(q, "parent_mobile")} · {s(q, "class_label")} · {s(q, "board")} · Interested in: {s(q, "interested_in")}{s(q, "notes") ? ` · ${s(q, "notes")}` : ""}</div>)}</div>
        </div>
        <div className="card mt-3"><h3 className="font-extrabold">Live counts</h3><ul className="mt-2 space-y-1 text-sm text-slate-600"><li>Batches: {counts.batches ?? 0}</li><li>Lectures: {counts.lectures ?? 0}</li><li>Assignments: {counts.assignments ?? 0}</li><li>Tests: {counts.tests ?? 0}</li><li>Fees recorded: {counts.fees ?? 0}</li><li>Open doubts: {counts.doubts ?? 0}</li></ul></div>
      </div>
    );
    return null;
  }
}
