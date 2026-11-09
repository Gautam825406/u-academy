"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FEATURES, FEATURE_KEYS, type Profile } from "@/lib/types";
import InstallAppButton from "@/components/InstallAppButton";

type Row = Record<string, unknown>;
const s = (r: Row | null | undefined, k: string) => String((r as Row)?.[k] ?? "");
const n = (r: Row | null | undefined, k: string) => Number((r as Row)?.[k] ?? 0) || 0;
const JUMP_TO = ["lectures","assignments","tests","live_classes","materials","attendance","fees","doubts"];
// ---- Role-based access (real, not CSS hiding) ----
// Students see ONLY the 11 learning sections. Teachers keep teaching +
// Reports (analytics belong to Admin/Teacher) but never Users/Permissions
// (or the admin-only Leads/Coupons panels, which live inside Reports).
// Parents see their child's learning view. Admin sees everything.
// A section outside a role's list can never be opened: openSection() and
// the render guard below both enforce this list.
const ROLE_SECTIONS: Record<string, string[]> = {
  student: ["overview","batches","live_classes","lectures","assignments","doubts","materials","notifications","attendance","fees","profile"],
  parent: ["overview","batches","live_classes","lectures","assignments","tests","materials","notifications","attendance","fees","doubts","profile"],
  teacher: ["overview","batches","lectures","materials","assignments","tests","live_classes","attendance","doubts","notifications","reports","profile"],
  admin: ["overview","batches","lectures","materials","assignments","tests","live_classes","attendance","fees","doubts","notifications","reports","users","permissions","profile"],
};
// Student-facing display names for the 11 student sections.
const STUDENT_LABELS: Record<string, string> = {
  overview: "Overview", batches: "My Batches", live_classes: "Live Classes",
  lectures: "Recorded Lectures", assignments: "Assignments", doubts: "Doubt Forum",
  materials: "Study Materials", notifications: "Announcements", attendance: "Attendance",
  fees: "My Payments", profile: "Profile & Settings",
};
const SECTION_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Main", keys: ["overview"] },
  { title: "My Learning", keys: ["batches","live_classes","lectures","assignments","tests","materials"] },
  { title: "Track & Support", keys: ["attendance","fees","doubts","notifications"] },
  { title: "Institute & Account", keys: ["reports","users","permissions","profile"] },
];
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
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", mobile: "", role: "teacher", class_label: "Class 10", board: "CBSE", subject: "Mathematics" });
  // ClassWalla-style state
  const [courseForm, setCourseForm] = useState({ title: "", class_label: "Class 10", subject: "", description: "", price: "", is_paid: false, bundle_name: "" });
  const [courseId, setCourseId] = useState("");
  const [courseStu, setCourseStu] = useState("");
  const [courseCoupon, setCourseCoupon] = useState("");
  const [ttForm, setTtForm] = useState({ batch_id: "", day_of_week: "Monday", start_time: "", end_time: "", subject: "", teacher_id: "" });
  const [feeMode, setFeeMode] = useState("Cash");
  const [feeUpiRef, setFeeUpiRef] = useState("");
  const [feeCoupon, setFeeCoupon] = useState("");
  const [feeUpiId, setFeeUpiId] = useState("");
  const [cert, setCert] = useState<null | { student: string; test: string; marks: number; total: number; date: string }>(null);
  const [couponForm, setCouponForm] = useState({ code: "", discount_percent: "", valid_until: "" });
  const [leadStatus, setLeadStatus] = useState<Record<string, string>>({});
  const [leadFollow, setLeadFollow] = useState<Record<string, string>>({});
  const [leadEmail, setLeadEmail] = useState<Record<string, string>>({});
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const [payBusy, setPayBusy] = useState("");
  // PW-style subscription plans
  const [planBatch, setPlanBatch] = useState("");
  const [planForm, setPlanForm] = useState({ name: "Monthly", price: "", mrp: "", duration_days: "30", features: "" });
  const [selPlan, setSelPlan] = useState<Record<string, string>>({});
  // Doubt Forum state
  const [forumTab, setForumTab] = useState<"recent" | "unanswered" | "mine" | "helpful">("recent");
  const [forumSearch, setForumSearch] = useState("");
  const [forumSubject, setForumSubject] = useState("");
  const [forumBatch, setForumBatch] = useState("");
  const [forumStatus, setForumStatus] = useState("");
  const [forumForm, setForumForm] = useState({ title: "", body: "", subject: "", batch_id: "", image_url: "" });
  const [showAsk, setShowAsk] = useState(false);
  const [openQ, setOpenQ] = useState("");
  const [ansText, setAnsText] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string>>({});
  const [dataLoading, setDataLoading] = useState(false);
  // Batch thumbnail upload + batch edit (Admin only)
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const [demoUploading, setDemoUploading] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [editingBatch, setEditingBatch] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  // All Batches vs My Batches (student split view) — the tabs live inside
  // the "batches" section; the sidebar / bottom tab still open this section.
  const [batchTab, setBatchTab] = useState<"all" | "mine">("mine");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchClass, setBatchClass] = useState("");
  const [expandedBatch, setExpandedBatch] = useState("");
  const [learnBatch, setLearnBatch] = useState("");

  useEffect(() => { loadProfile(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Session restoration: if the session arrives (or is refreshed) after
  // mount — PWA launch, token refresh completing late, return from a
  // payment — re-run the profile load. Only a genuine SIGNED_OUT event
  // sends the user to login; a transient failure never does.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") loadProfile();
      if (event === "SIGNED_OUT") router.push("/auth/login");
    });
    return () => subscription.unsubscribe();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  // Cashfree return landing: /dashboard?section=batches&paid=1 (or payment=failed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get("section");
    if (sec) setSection(sec);
    if (params.get("paid") === "1") setMsg("Payment successful — you are enrolled in the batch. Welcome!");
    if (params.get("payment") === "failed") setMsg("Payment did not complete — you were not charged. You can try again, or pay at the institute in cash/UPI and ask Admin to confirm your enrolment.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (profile) loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section, profile]);

  async function loadProfile() {
    // Session restore (auto-logout fix): getSession() reads the stored
    // session and refreshes an expired access token from the refresh-token
    // cookie. Only when there is NO session at all — after a refresh
    // attempt and one retry of the validating getUser() call — do we
    // redirect to login. A single failed getUser() (network blip, refresh
    // still in flight) used to log the student out instantly; it no longer
    // does. Enrolments and account data are re-fetched from the DB by user
    // id in loadAll(), so they survive any restore.
    const { data: { session } } = await supabase.auth.getSession();
    let user = session?.user ?? null;
    if (!user) {
      // No stored session yet — maybe the refresh is still settling.
      await new Promise((r) => setTimeout(r, 800));
      const retry = await supabase.auth.getSession();
      user = retry.data.session?.user ?? null;
    }
    if (!user) {
      const { data: { user: validated } } = await supabase.auth.getUser();
      user = validated;
    }
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

  // ---- Data loading, scoped by role ----
  // Root cause (audit #2/#5): loadAll used to fetch EVERY row of EVERY
  // table for EVERY role — a student received all profiles, fees and
  // payments. Now each role only fetches what it may see: students/parents
  // fetch only their own enrolments, subscriptions, payments, fees,
  // attendance, submissions and results, and batch content only for
  // batches they hold an active enrolment/subscription for. Admin still
  // loads everything; teachers load only their own batches + their
  // students. NOTE: this is a frontend query scope, not a substitute for
  // per-batch RLS — the Supabase policies remain the permissive
  // authenticated-user set (see AUDIT.md). Batches + plans are the public
  // catalogue, so all roles read them (needed to browse and buy).
  async function loadAll() {
    if (!profile) return;
    setDataLoading(true);
    const role = profile.role;
    const out: Record<string, Row[]> = {};
    const fetchAll = async (t: string) => {
      const { data: d } = await supabase.from(t).select("*").order("created_at", { ascending: false }).limit(200);
      out[t] = (d as Row[]) || [];
    };
    const fetchEq = async (t: string, col: string, val: string) => {
      const { data: d } = await supabase.from(t).select("*").eq(col, val).order("created_at", { ascending: false }).limit(200);
      out[t] = (d as Row[]) || [];
    };
    const fetchIn = async (t: string, col: string, vals: string[]) => {
      if (!vals.length) { out[t] = []; return; }
      const { data: d } = await supabase.from(t).select("*").in(col, vals).order("created_at", { ascending: false }).limit(200);
      out[t] = (d as Row[]) || [];
    };
    // Profiles are needed for names (teachers, classmates in a forum).
    // Only id/name/role/class/subject are fetched for non-admins.
    if (role === "admin") {
      await fetchAll("profiles");
    } else {
      const { data: d } = await supabase.from("profiles").select("id,full_name,email,role,class_label,board,subject,child_name,child_student_id").order("created_at", { ascending: false }).limit(200);
      out.profiles = (d as Row[]) || [];
    }
    await fetchAll("batches");
    await fetchAll("batch_plans");
    await fetchAll("role_permissions");
    await fetchAll("announcements");
    await fetchAll("courses");
    await fetchAll("coupons");
    if (role === "admin") {
      for (const t of ["enrollments","lectures","materials","assignments","submissions","tests","test_results","live_classes","doubts","notifications","fees","attendance","enquiries","teacher_requests","onboarding_invites","timetable","course_enrollments","payments","subscriptions","doubt_questions","doubt_answers","doubt_votes"]) await fetchAll(t);
    } else if (role === "teacher") {
      const myBatches = (out.batches || []).filter(b => s(b, "teacher_id") === profile.id).map(b => s(b, "id"));
      await fetchAll("enrollments");
      await fetchAll("subscriptions");
      await fetchIn("lectures", "batch_id", myBatches);
      await fetchIn("materials", "batch_id", myBatches);
      await fetchIn("assignments", "batch_id", myBatches);
      await fetchIn("tests", "batch_id", myBatches);
      await fetchIn("live_classes", "batch_id", myBatches);
      await fetchIn("timetable", "batch_id", myBatches);
      await fetchIn("attendance", "batch_id", myBatches);
      await fetchIn("doubt_questions", "batch_id", myBatches);
      const qIds = (out.doubt_questions || []).map(q => s(q, "id"));
      await fetchIn("doubt_answers", "question_id", qIds);
      await fetchAll("doubts");
      await fetchAll("submissions");
      await fetchAll("test_results");
      await fetchEq("notifications", "user_id", profile.id);
      out.fees = []; out.payments = []; out.enquiries = []; out.teacher_requests = []; out.onboarding_invites = []; out.course_enrollments = []; out.doubt_votes = [];
      await fetchAll("doubt_votes");
    } else {
      // student / parent: everything is scoped to the effective student.
      // For a parent, the linked child id comes from the profile itself
      // (data.profiles is still loading on the first pass, so do not
      // rely on the derived childProfile here).
      const eid = role === "parent" && profile.child_student_id ? String(profile.child_student_id) : effectiveId;
      await fetchEq("enrollments", "student_id", eid);
      await fetchEq("subscriptions", "student_id", eid);
      await fetchEq("payments", "student_id", eid);
      await fetchEq("fees", "student_id", eid);
      await fetchEq("attendance", "student_id", eid);
      await fetchEq("submissions", "student_id", eid);
      await fetchEq("test_results", "student_id", eid);
      await fetchEq("notifications", "user_id", profile.id);
      await fetchEq("course_enrollments", "student_id", eid);
      // Batch content only for batches with an active enrolment/subscription.
      const tStr = new Date().toISOString().slice(0, 10);
      const activeIds = Array.from(new Set([
        ...(out.subscriptions || []).filter(x => s(x, "status") !== "cancelled" && (!s(x, "valid_until") || s(x, "valid_until") >= tStr)).map(x => s(x, "batch_id")),
        ...(out.enrollments || []).filter(e => (s(e, "subscription_status") || "active") === "active" && (!s(e, "valid_until") || s(e, "valid_until") >= tStr)).map(e => s(e, "batch_id")),
      ]));
      await fetchIn("lectures", "batch_id", activeIds);
      await fetchIn("materials", "batch_id", activeIds);
      await fetchIn("assignments", "batch_id", activeIds);
      await fetchIn("tests", "batch_id", activeIds);
      await fetchIn("live_classes", "batch_id", activeIds);
      await fetchIn("timetable", "batch_id", activeIds);
      // Forum: questions in my batches + my own questions anywhere.
      const { data: dq } = await supabase.from("doubt_questions").select("*").order("created_at", { ascending: false }).limit(200);
      out.doubt_questions = ((dq as Row[]) || []).filter(q => activeIds.includes(s(q, "batch_id")) || s(q, "student_id") === eid);
      const qIds = (out.doubt_questions || []).map(q => s(q, "id"));
      await fetchIn("doubt_answers", "question_id", qIds);
      await fetchAll("doubt_votes");
      await fetchEq("doubts", "student_id", eid);
      out.enquiries = []; out.teacher_requests = []; out.onboarding_invites = [];
    }
    setData(out);
    setCounts({ batches: out.batches.length, lectures: out.lectures.length, assignments: out.assignments.length, tests: out.tests.length, fees: out.fees.length, doubts: (out.doubt_questions || []).filter(r => s(r, "status") === "open").length });
    setPerms(out.role_permissions);
    setDataLoading(false);
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
  const viewStudent = (r: Row) => profile?.role === "teacher" ? (myBatchIds.includes(s(r, "batch_id")) || teacherStudentIds.has(s(r, "student_id"))) : isStaff || s(r, "student_id") === effectiveId;
  const viewUser = (r: Row) => isStaff || s(r, "user_id") === effectiveId || s(r, "user_id") === profile?.id;
  // ---- PW-style access: a student sees a batch's content only while they
  // hold an ACTIVE subscription for it (valid_until >= today). Legacy
  // enrolments with no valid_until (created before subscriptions existed)
  // are grandfathered as active. Teachers see only their own batches.
  const todayStr = new Date().toISOString().slice(0, 10);
  const subStatus = (sub: Row) => {
    if (s(sub, "status") === "cancelled") return "cancelled";
    const vu = s(sub, "valid_until");
    return vu && vu < todayStr ? "expired" : "active";
  };
  const mySubs = (data.subscriptions || []).filter(x => s(x, "student_id") === effectiveId);
  const activeBatchIds = new Set<string>([
    ...mySubs.filter(x => subStatus(x) === "active").map(x => s(x, "batch_id")),
    ...(data.enrollments || []).filter(e => s(e, "student_id") === effectiveId && (s(e, "subscription_status") || "active") === "active" && (!s(e, "valid_until") || s(e, "valid_until") >= todayStr)).map(e => s(e, "batch_id")),
  ]);
  const myBatchIds = profile?.role === "teacher" ? batches.filter(b => s(b, "teacher_id") === profile?.id).map(b => s(b, "id")) : [];
  const canSeeBatch = (batchId: string) => {
    if (profile?.role === "admin") return true;
    if (profile?.role === "teacher") return myBatchIds.includes(batchId);
    return batchId ? activeBatchIds.has(batchId) : false;
  };
  const teacherStudentIds = new Set((data.enrollments || []).filter(e => myBatchIds.includes(s(e, "batch_id"))).map(e => s(e, "student_id")));
  const subFor = (studentId: string, batchId: string) => mySubs.find(x => s(x, "student_id") === studentId && s(x, "batch_id") === batchId) || (data.enrollments || []).find(e => s(e, "student_id") === studentId && s(e, "batch_id") === batchId);
  const planDiscount = (pl: Row) => { const mrp = n(pl, "mrp"); const pr = n(pl, "price"); return mrp > pr ? Math.round((mrp - pr) / mrp * 100) : 0; };
  const planValidity = (pl: Row) => { const d = n(pl, "duration_days"); return d >= 9999 ? "Full Course — lifetime access" : d >= 365 ? `Valid ${Math.round(d / 365)} year${d >= 730 ? "s" : ""}` : d >= 30 ? `Valid ${Math.round(d / 30)} month${d >= 60 ? "s" : ""}` : `Valid ${d} days`; };
  // ---- All Batches vs My Batches (student) ----
  // My Batches is derived ONLY from the enrollments table for the effective
  // student — viewing a batch, starting a payment, failing or cancelling it
  // never adds a row here; only a verified enrolment does (return/webhook
  // routes after Cashfree confirms PAID, or Admin manual enrolment).
  const myEnrols = (data.enrollments || []).filter(e => s(e, "student_id") === effectiveId);
  const myBatchesList = myEnrols.map(e => batches.find(b => s(b, "id") === s(e, "batch_id"))).filter(Boolean) as Row[];
  const classOptions = Array.from(new Set(batches.map(b => s(b, "class_label")).filter(Boolean))).sort();
  // Catalogue: published batches only — never closed/archived. Upcoming
  // batches stay visible (status shown, enrolment disabled) so students
  // can see what is coming; closed ones are hidden from students.
  const catalogBatches = batches.filter(b => (s(b, "status") || "active") !== "closed");
  const filteredCatalog = catalogBatches.filter(b => {
    if (batchClass && s(b, "class_label") !== batchClass) return false;
    const q = batchSearch.trim().toLowerCase();
    if (!q) return true;
    return [s(b, "name"), s(b, "subject"), s(b, "class_label"), s(b, "board")].join(" ").toLowerCase().includes(q);
  });
  // Learning progress, computed honestly from existing data only: tasks
  // completed (assignment submitted / test result entered) vs tasks set for
  // that batch. There is no lecture-watch table, so lectures are NOT counted
  // and no fake percentage is ever shown. Returns null when the batch has
  // no assignments/tests yet.
  const batchProgress = (batchId: string) => {
    const asg = (data.assignments || []).filter(a => s(a, "batch_id") === batchId);
    const tst = (data.tests || []).filter(t => s(t, "batch_id") === batchId);
    const total = asg.length + tst.length;
    if (!total) return null;
    const doneAsg = asg.filter(a => (data.submissions || []).some(x => s(x, "assignment_id") === s(a, "id") && s(x, "student_id") === effectiveId)).length;
    const doneTst = tst.filter(x => (data.test_results || []).some(y => s(y, "test_id") === s(x, "id") && s(y, "student_id") === effectiveId)).length;
    return { done: doneAsg + doneTst, total };
  };

  function isEnabled(key: string) {
    if (!profile) return false;
    if (profile.role === "admin") return true;
    const row = perms.find(p => p.role === profile.role && p.feature_key === key);
    return row ? Boolean(row.enabled) : true;
  }
  function isAdminOnly(key: string) { return key === "users" || key === "permissions"; }
  const allowedSections = (role?: string) => ROLE_SECTIONS[role || "student"] || ROLE_SECTIONS.student;
  const sectionLabel = (key: string) => {
    if (profile?.role === "student" || profile?.role === "parent") return STUDENT_LABELS[key] || FEATURES[FEATURE_KEYS.indexOf(key as never)] || key;
    return FEATURES[FEATURE_KEYS.indexOf(key as never)] || key;
  };
  function openSection(key: string) {
    // Route protection: a role may only open its own sections. Trying to
    // open Reports/Users/Permissions as a student lands on Overview with
    // an explanation instead of the section.
    if (profile && !allowedSections(profile.role).includes(key)) { setSection("overview"); setMsg("That section is not available for your role."); setDrawer(false); setMoreOpen(false); return; }
    setSection(key); setDrawer(false); setMoreOpen(false); setMsg(""); window.scrollTo({ top: 0 });
  }
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
    if (payload.price !== undefined && payload.price !== "") payload.price = Number(payload.price);
    if (payload.capacity !== undefined && payload.capacity !== "") payload.capacity = Number(payload.capacity);
    if (payload.status === "") payload.status = "active";
    if (payload.batch_id === "") payload.batch_id = null;
    if (payload.teacher_id === "") payload.teacher_id = null;
    if (payload.starts_at) payload.starts_at = new Date(String(payload.starts_at)).toISOString();
    if (section === "live_classes" && !payload.status) payload.status = "scheduled";
    payload.created_by = profile?.id;
    const { error } = await supabase.from(table).insert(payload);
    if (error) setMsg(error.message); else { setForm({}); setMsg("Saved."); loadAll(); }
  }
  // ---- Batch thumbnail upload (Admin only) ----
  // Uploads to the public 'batch-thumbnails' Storage bucket and returns the
  // public URL, stored as batches.thumbnail_url. Path pattern:
  // batch-<uuid>.<ext> — unique per upload, so replacing a thumbnail never
  // overwrites another batch's image. Falls back to a pasted image URL
  // (the thumbnail_url text field) if the bucket is not set up yet.
  const ALLOWED_THUMB_TYPES = ["image/jpeg", "image/png", "image/webp"];
  async function uploadThumbnail(file: File): Promise<string | null> {
    setThumbError("");
    if (!ALLOWED_THUMB_TYPES.includes(file.type)) { setThumbError("Please pick a JPG, PNG or WebP image."); return null; }
    if (file.size > 5 * 1024 * 1024) { setThumbError("Image must be 5 MB or smaller."); return null; }
    setThumbUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `batch-${uuid}.${ext}`;
    const { error } = await supabase.storage.from("batch-thumbnails").upload(path, file, { cacheControl: "3600", upsert: false });
    setThumbUploading(false);
    if (error) { setThumbError(`${error.message} — run supabase/add-batch-description-thumbnail.sql in Supabase, or paste an image URL below instead.`); return null; }
    const { data } = supabase.storage.from("batch-thumbnails").getPublicUrl(path);
    return data.publicUrl;
  }
  // Called from a file input: uploads, then writes the public URL into the
  // given form setter (create form or edit form).
  async function onThumbPicked(file: File | undefined, setUrl: (url: string) => void) {
    if (!file) return;
    const url = await uploadThumbnail(file);
    if (url) setUrl(url);
  }
  // ---- Batch demo lecture PDF upload (Admin only) ----
  // Uploads to the public 'batch-demo-pdfs' Storage bucket and returns the
  // public URL, stored as batches.demo_pdf_url. Path pattern:
  // demo-<uuid>.pdf. Students open it BEFORE buying — the batch card's
  // "Free Demo Lecture" button is never gated behind enrolment/payment.
  async function uploadDemoPdf(file: File): Promise<string | null> {
    setDemoError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setDemoError("Please pick a PDF file."); return null; }
    if (file.size > 10 * 1024 * 1024) { setDemoError("PDF must be 10 MB or smaller."); return null; }
    setDemoUploading(true);
    const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `demo-${uuid}.pdf`;
    const { error } = await supabase.storage.from("batch-demo-pdfs").upload(path, file, { cacheControl: "3600", upsert: false, contentType: "application/pdf" });
    setDemoUploading(false);
    if (error) { setDemoError(`${error.message} — run supabase/add-batch-demo-pdf.sql in Supabase, or paste a PDF URL below instead.`); return null; }
    const { data } = supabase.storage.from("batch-demo-pdfs").getPublicUrl(path);
    return data.publicUrl;
  }
  async function onDemoPdfPicked(file: File | undefined, setUrl: (url: string) => void) {
    if (!file) return;
    const url = await uploadDemoPdf(file);
    if (url) setUrl(url);
  }
  const demoFileName = (url: string) => { try { return decodeURIComponent(url.split("?")[0].split("/").pop() || "demo-lecture.pdf"); } catch { return "demo-lecture.pdf"; } };
  function startEditBatch(b: Row) {
    setEditingBatch(b);
    setEditForm({
      name: s(b, "name"), class_label: s(b, "class_label"), board: s(b, "board"),
      subject: s(b, "subject"), price: String(b.price ?? ""), capacity: String(b.capacity ?? ""),
      status: s(b, "status") || "active", teacher_id: s(b, "teacher_id"),
      description: s(b, "description"), thumbnail_url: s(b, "thumbnail_url"),
      demo_pdf_url: s(b, "demo_pdf_url"),
    });
    setThumbError(""); setDemoError("");
  }
  async function saveEditBatch(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!editingBatch || profile?.role !== "admin") return;
    const payload: Record<string, unknown> = {
      name: editForm.name, class_label: editForm.class_label,
      board: editForm.board || null, subject: editForm.subject || null,
      description: editForm.description || null, thumbnail_url: editForm.thumbnail_url || null,
      demo_pdf_url: editForm.demo_pdf_url || null,
      price: editForm.price === "" ? 0 : Number(editForm.price),
      capacity: editForm.capacity === "" ? null : Number(editForm.capacity),
      status: editForm.status || "active", teacher_id: editForm.teacher_id || null,
    };
    const { error } = await supabase.from("batches").update(payload).eq("id", s(editingBatch, "id"));
    if (error) setMsg(error.message);
    else { setMsg(`Batch "${editForm.name}" updated.`); setEditingBatch(null); setEditForm({}); loadAll(); }
  }
  async function enrol() {
    if (!enrolBatch || !enrolStudent) return setMsg("Pick a batch and a student to enrol.");
    const { error } = await supabase.from("enrollments").insert({ batch_id: enrolBatch, student_id: enrolStudent });
    if (error) setMsg(error.message); else { setMsg(`Enrolled ${nameOf(enrolStudent)} into ${batchName(enrolBatch)}.`); loadAll(); }
  }
  async function createPlan(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!planBatch || !planForm.name || planForm.price === "") return setMsg("Pick a batch, a plan name and a price.");
    const { error } = await supabase.from("batch_plans").insert({ batch_id: planBatch, name: planForm.name, price: Number(planForm.price), mrp: planForm.mrp ? Number(planForm.mrp) : null, duration_days: Number(planForm.duration_days || 30), features: planForm.features || null });
    if (error) setMsg(error.message); else { setMsg(`Plan "${planForm.name}" created for ${batchName(planBatch)}.`); setPlanForm({ name: "Monthly", price: "", mrp: "", duration_days: "30", features: "" }); loadAll(); }
  }
  async function togglePlan(row: Row) {
    const { error } = await supabase.from("batch_plans").update({ is_active: String(row.is_active) === "false" }).eq("id", row.id as string);
    if (error) setMsg(error.message); else loadAll();
  }
  // ---- Cashfree pay-and-enrol (student) ----
  async function payAndEnrol(batchId: string, planId?: string) {
    const batch = batches.find(b => s(b, "id") === batchId);
    const price = planId ? n((data.batch_plans || []).find(x => s(x, "id") === planId), "price") : (batch ? n(batch, "price") : 0);
    setPayBusy(batchId); setMsg("");
    try {
      // Refresh the student session before paying: a stale/expired token
      // makes create-order return 401 "Not signed in" at pay time, which
      // the student sees as a failed payment. If there is no session at
      // all, say so instead of attempting the order.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg("Your session expired — please log in again and try paying."); return; }
      const res = await fetch("/api/cashfree/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId, plan_id: planId || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = String(data.error || "");
        if (err.includes("Cashfree authentication failed")) {
          // Cashfree rejected the institute's payment keys — a config
          // problem for Admin, NOT a reason to tell the student to pay
          // at the institute as if Cashfree were simply not set up.
          setMsg(err);
          return;
        }
        setMsg(err || "Could not start the payment.");
        if (err.includes("not configured")) {
          setMsg("Cashfree is not set up yet. Pay at the institute in cash/UPI — Admin will confirm your enrolment in Batches.");
        }
        if (err.includes("Not signed in")) {
          setMsg("Your session expired — please log in again and try paying.");
        }
        return;
      }
      if (data.free) { setMsg(`Enrolled in ${data.title || "the batch"} — it is free.`); loadAll(); return; }
      // Cashfree hosted checkout — official JS SDK v3 ONLY.
      // Root cause of "Invalid form code: null": the old code navigated the
      // browser to https://payments.cashfree.com/forms?paymentSessionId=...
      // — but /forms is Cashfree's separate no-code Payment Forms product.
      // A PG payment_session_id is not a form code, so the Forms app found
      // no form and showed "Invalid form code: null". The official docs
      // (cashfree.com/docs/payments/online/web/redirect) say checkout opens
      // ONLY via cashfree.checkout({ paymentSessionId, redirectTarget }).
      // Never redirect, never guess a session id, never use payment_link
      // (PG Create Order does not return one — that is a Payment Links
      // field). The SDK mode MUST match the environment the order was
      // created in (returned as cashfree_mode by the server).
      const sessionId = data.payment_session_id as string | undefined;
      const mode = data.cashfree_mode === "production" ? "production" : "sandbox";
      if (!sessionId || sessionId === "null" || sessionId === "undefined") {
        setMsg("Cashfree did not return a checkout session. Please try again or pay at the institute.");
        return;
      }
      let cashfree: Awaited<ReturnType<typeof import("@cashfreepayments/cashfree-js").load>> = null;
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        cashfree = await load({ mode });
      } catch {
        setMsg("Could not load the Cashfree checkout. Check your connection and try again.");
        return;
      }
      if (!cashfree) {
        setMsg("Could not load the Cashfree checkout. Please try again.");
        return;
      }
      // redirectTarget "_self": full-page hosted checkout, then Cashfree
      // redirects back to the order's return_url (handled server-side by
      // /api/cashfree/return, which verifies PAID before enrolling). The
      // promise may never resolve once navigation starts — that is normal.
      const result = await cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_self" });
      if (result?.error) {
        const code = String(result.error.code || "");
        if (code === "session_expired") setMsg("Your payment session expired — please tap Pay again for a fresh checkout.");
        else if (code === "user_cancelled") setMsg("Payment cancelled — you can try again whenever you are ready.");
        else if (code === "invalid_payment_session_id") setMsg("Cashfree could not start this checkout (invalid session). Please tap Pay again — if it keeps happening, ask Admin to check the Cashfree app mode.");
        else setMsg(String(result.error.message || "Cashfree checkout could not be opened. Please try again."));
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not start the payment.");
    } finally { setPayBusy(""); }
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
    const base = Number(feeAmt);
    const cp = feeCoupon ? findCoupon(feeCoupon) : null;
    const finalAmt = cp ? Math.round(base * (1 - n(cp, "discount_percent") / 100)) : base;
    const { error } = await supabase.from("fees").insert({ student_id: feeStu, batch_id: feeBatch || null, amount: finalAmt, due_month: feeMonth || "", status: feeStatus, receipt_no: receipt, paid_at: feeStatus === "paid" ? new Date().toISOString() : null, payment_mode: feeMode, upi_reference: feeUpiRef || null, coupon_code: feeCoupon || null, created_by: profile?.id });
    if (error) setMsg(error.message); else { setMsg(`Fee saved. Receipt ${receipt}.` + (cp ? ` Coupon ${feeCoupon} applied (${n(cp, "discount_percent")}% off): ₹${base} → ₹${finalAmt}.` : "") + (feeMode === "UPI" ? " Recorded as a UPI payment — no online gateway is connected, so collect it on your UPI ID and keep the reference above." : "")); setFeeAmt(""); setFeeMonth(""); setFeeCoupon(""); setFeeUpiRef(""); loadAll(); }
  }
  async function markPaid(feeId: string) {
    const { error } = await supabase.from("fees").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", feeId);
    if (error) setMsg(error.message); else { setMsg("Marked as paid."); loadAll(); }
  }
  // ---- ClassWalla: coupons / courses / timetable / leads ----
  function findCoupon(code: string) {
    const today = new Date().toISOString().slice(0, 10);
    return (data.coupons || []).find(x => s(x, "code").toLowerCase() === code.trim().toLowerCase() && String(x.is_active) !== "false" && (!s(x, "valid_until") || s(x, "valid_until") >= today)) || null;
  }
  async function createCourse(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!courseForm.title) return setMsg("Course title is required.");
    const { error } = await supabase.from("courses").insert({ title: courseForm.title, class_label: courseForm.class_label, subject: courseForm.subject, description: courseForm.description, price: Number(courseForm.price || 0), is_paid: courseForm.is_paid, bundle_name: courseForm.bundle_name || null, created_by: profile?.id });
    if (error) setMsg(error.message); else { setMsg("Course saved."); setCourseForm({ title: "", class_label: "Class 10", subject: "", description: "", price: "", is_paid: false, bundle_name: "" }); loadAll(); }
  }
  async function enrolCourse() {
    if (!courseId || !courseStu) return setMsg("Pick a course and a student.");
    const course = (data.courses || []).find(c => s(c, "id") === courseId);
    const base = course ? n(course, "price") : 0;
    const cp = courseCoupon ? findCoupon(courseCoupon) : null;
    if (courseCoupon && !cp) return setMsg(`Coupon ${courseCoupon} is not valid (check the code, expiry or active status).`);
    const paid = cp ? Math.round(base * (1 - n(cp, "discount_percent") / 100)) : base;
    const { error } = await supabase.from("course_enrollments").insert({ course_id: courseId, student_id: courseStu, price_paid: paid, coupon_code: courseCoupon || null });
    if (error) setMsg(error.message); else { setMsg(`Enrolled ${nameOf(courseStu)} into ${course ? s(course, "title") : "course"} — ₹${paid} paid${cp ? ` (coupon ${courseCoupon} applied)` : ""}.`); setCourseCoupon(""); loadAll(); }
  }
  async function createTimetable(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!ttForm.batch_id || !ttForm.start_time || !ttForm.end_time) return setMsg("Pick a batch and start/end times.");
    const { error } = await supabase.from("timetable").insert({ batch_id: ttForm.batch_id, day_of_week: ttForm.day_of_week, start_time: ttForm.start_time, end_time: ttForm.end_time, subject: ttForm.subject, teacher_id: ttForm.teacher_id || null });
    if (error) setMsg(error.message); else { setMsg("Timetable row saved."); loadAll(); }
  }
  async function createCoupon(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!couponForm.code || !couponForm.discount_percent) return setMsg("Coupon code and % off are required.");
    const { error } = await supabase.from("coupons").insert({ code: couponForm.code.trim().toUpperCase(), discount_percent: Number(couponForm.discount_percent), valid_until: couponForm.valid_until || null, created_by: profile?.id });
    if (error) setMsg(error.message); else { setMsg(`Coupon ${couponForm.code.trim().toUpperCase()} created.`); setCouponForm({ code: "", discount_percent: "", valid_until: "" }); loadAll(); }
  }
  async function toggleCoupon(row: Row) {
    const { error } = await supabase.from("coupons").update({ is_active: String(row.is_active) === "false" }).eq("id", row.id as string);
    if (error) setMsg(error.message); else loadAll();
  }
  async function updateLead(id: string) {
    const payload: Record<string, unknown> = {};
    if (leadStatus[id]) payload.status = leadStatus[id];
    if (leadFollow[id]) payload.follow_up_date = leadFollow[id];
    if (!Object.keys(payload).length) return setMsg("Pick a status or a follow-up date first.");
    const { error } = await supabase.from("enquiries").update(payload).eq("id", id);
    if (error) setMsg(error.message); else { setMsg("Lead updated."); loadAll(); }
  }
  async function convertLead(q: Row) {
    const email = (leadEmail[s(q, "id")] || "").trim();
    if (!email) return setMsg("Enter the student's email for the invite first.");
    const { error } = await supabase.from("onboarding_invites").insert({ full_name: s(q, "student_name"), email, mobile: s(q, "parent_mobile"), role: "student", class_label: s(q, "class_label") || "Class 10", board: s(q, "board") || "CBSE", created_by: profile?.id });
    if (error) { setMsg(error.message); return; }
    await supabase.from("enquiries").update({ status: "enrolled" }).eq("id", s(q, "id"));
    setMsg(`Invite created for ${email} — ask them to Register with that exact email. Lead marked enrolled.`); loadAll();
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
  // ---- Doubt Discussion Forum (doubt_questions / doubt_answers / doubt_votes) ----
  async function askForumQuestion(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!forumForm.title.trim() || !forumForm.body.trim()) return setMsg("A title and a detailed description are required.");
    if (!forumForm.batch_id) return setMsg("Pick the batch this doubt belongs to.");
    const { error } = await supabase.from("doubt_questions").insert({
      student_id: effectiveId, student_name: effectiveName, batch_id: forumForm.batch_id,
      subject: forumForm.subject || "General", title: forumForm.title.trim(),
      body: forumForm.body.trim(), image_url: forumForm.image_url.trim() || null, status: "open",
    });
    if (error) { setMsg(error.message.includes("doubt_questions") ? "The doubt forum tables are not set up yet — ask Admin to run supabase/add-doubt-forum.sql in Supabase." : error.message); return; }
    setForumForm({ title: "", body: "", subject: "", batch_id: "", image_url: "" }); setShowAsk(false);
    setMsg("Your doubt is posted — classmates and teachers in this batch can answer it."); loadAll();
  }
  async function postForumAnswer(qid: string, parentId?: string) {
    const key = parentId ? `${qid}:${parentId}` : qid;
    const body = (ansText[key] || "").trim();
    if (!body) return setMsg("Write your answer first.");
    const q = (data.doubt_questions || []).find(x => s(x, "id") === qid);
    const { error } = await supabase.from("doubt_answers").insert({
      question_id: qid, author_id: profile?.id, author_name: profile?.full_name || "User",
      author_role: profile?.role || "student", body, parent_answer_id: parentId || null, is_accepted: false,
    });
    if (error) { setMsg(error.message); return; }
    // The question is now answered; notify the asker (unless they answered it themselves).
    await supabase.from("doubt_questions").update({ status: "answered" }).eq("id", qid).eq("status", "open");
    if (q && s(q, "student_id") !== profile?.id) {
      await supabase.from("notifications").insert({ user_id: s(q, "student_id"), title: `New answer to your doubt: ${s(q, "title")}`, body: `${profile?.full_name || "Someone"} answered your question. Open Doubt Forum to read it.` });
    }
    setAnsText({ ...ansText, [key]: "" }); setReplyTo({ ...replyTo, [key]: "" });
    setMsg("Answer posted."); loadAll();
  }
  async function toggleVote(answerId: string) {
    if (!profile) return;
    const existing = (data.doubt_votes || []).find(v => s(v, "answer_id") === answerId && s(v, "user_id") === profile.id);
    if (existing) {
      const { error } = await supabase.from("doubt_votes").delete().eq("id", s(existing, "id"));
      if (error) setMsg(error.message); else loadAll();
    } else {
      const { error } = await supabase.from("doubt_votes").insert({ answer_id: answerId, user_id: profile.id, vote: 1 });
      if (error) setMsg(error.message); else loadAll();
    }
  }
  async function acceptAnswer(qid: string, answerId: string) {
    const q = (data.doubt_questions || []).find(x => s(x, "id") === qid);
    if (!q) return;
    // Only the asker (or a teacher) may mark an answer accepted.
    if (s(q, "student_id") !== effectiveId && profile?.role !== "teacher" && profile?.role !== "admin") return setMsg("Only the student who asked, or a teacher, can accept an answer.");
    await supabase.from("doubt_answers").update({ is_accepted: false }).eq("question_id", qid);
    const { error } = await supabase.from("doubt_answers").update({ is_accepted: true }).eq("id", answerId);
    if (error) { setMsg(error.message); return; }
    await supabase.from("doubt_questions").update({ status: "resolved" }).eq("id", qid);
    setMsg("Answer marked as accepted — the doubt is resolved."); loadAll();
  }
  const forumAnswers = (qid: string) => (data.doubt_answers || []).filter(a => s(a, "question_id") === qid);
  const forumVotes = (answerId: string) => (data.doubt_votes || []).filter(v => s(v, "answer_id") === answerId).reduce((t, v) => t + n(v, "vote"), 0);
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
  // ---- teacher onboarding (Admin) ----
  async function reviewRequest(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("teacher_requests").update({ status, reviewed_by: profile?.id }).eq("id", id);
    if (error) setMsg(error.message); else { setMsg(`Teacher request ${status}.`); loadAll(); }
  }
  async function createInvite(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const f = inviteForm;
    if (!f.full_name || !f.email) return setMsg("Name and email are required for an invite.");
    const { error } = await supabase.from("onboarding_invites").insert({
      full_name: f.full_name, email: f.email.trim(), mobile: f.mobile, role: f.role,
      class_label: f.role === "student" ? f.class_label : null,
      board: f.role === "student" ? f.board : null,
      subject: f.role === "teacher" ? f.subject : null,
      created_by: profile?.id,
    });
    if (error) { setMsg(error.message); return; }
    if (f.role === "teacher") {
      // So the invitee also sees their request as approved on the register page.
      await supabase.from("teacher_requests").insert({
        full_name: f.full_name, email: f.email.trim(), mobile: f.mobile, subject: f.subject,
        status: "approved", reviewed_by: profile?.id,
      });
    }
    setInviteForm({ full_name: "", email: "", mobile: "", role: "teacher", class_label: "Class 10", board: "CBSE", subject: "Mathematics" });
    setMsg(`Invite created for ${f.email}. Ask them to Register on the live site with this exact email.`);
    loadAll();
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
    const who = profile?.role === "admin" ? students : profile?.role === "teacher" ? students.filter(p => teacherStudentIds.has(s(p, "id"))) : students.filter(p => s(p, "id") === effectiveId);
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
      <div className="mb-2 flex items-center gap-2 px-1"><img src="/logo.jpg" alt="U++ Academy" className="h-10 w-10 rounded-xl object-cover" /><span className="font-extrabold">U++ Academy</span></div>
      <div className="mb-2 rounded-2xl bg-brand-tint p-3"><b className="block">{profile.full_name}</b><span className="text-xs font-bold capitalize text-brand-dark">{profile.role}{profile.class_label ? ` · ${profile.class_label}` : ""}{profile.board ? ` · ${profile.board}` : ""}</span><span className="mt-1 block text-xs text-slate-500">{profile.email}</span>{childProfile && <span className="mt-1 block text-xs font-bold text-brand-dark">Viewing child: {effectiveName}</span>}</div>
      <p className="px-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{profile.role === "student" ? "My learning · 11 sections" : profile.role === "admin" ? "All features · 15 sections" : `${profile.role} · ${allowedSections(profile.role).length} sections`}</p>
      {SECTION_GROUPS.map((group) => {
        const keys = group.keys.filter(k => allowedSections(profile.role).includes(k));
        if (!keys.length) return null;
        return (
        <div key={group.title}>
          <p className="mt-3 px-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{group.title}</p>
          {keys.map((key) => {
            const i = FEATURE_KEYS.indexOf(key as never);
            const enabled = isEnabled(key);
            const adminOnly = isAdminOnly(key) && profile.role !== "admin";
            return (
              <button key={key} onClick={() => openSection(key)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${section===key ? "bg-brand-tint text-brand-dark" : "text-slate-600 hover:bg-slate-100"}`}>
                <span className="w-5 text-center">{["🏠","📚","▶","📄","✏","📝","📹","✓","₹","💬","🔔","📊","👥","🔐","👤"][i]}</span>
                <span className="flex-1">{sectionLabel(key)}</span>
                {adminOnly && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">Admin</span>}
                {!enabled && !adminOnly && <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-extrabold text-accent-ink">Off</span>}
              </button>
            );
          })}
        </div>
        );
      })}
      <button onClick={logout} className="mt-4 rounded-xl border px-3 py-2.5 text-left text-sm font-bold text-red-700">Log out</button>
    </div>
  );
  // Route protection: the section must be in this role's list AND enabled
  // in the permissions matrix. Reports/Users/Permissions are never in the
  // student or parent list, so they cannot be opened by any means —
  // switching section state, a deep link, or the More sheet.
  const sectionAllowed = allowedSections(profile?.role).includes(section);
  const sectionEnabled = sectionAllowed && (section === "overview" || section === "profile" || isEnabled(section));
  const sectionAdminOnly = isAdminOnly(section) && profile.role !== "admin";
  const sel = (label: string, value: string, onChange: (v: string) => void, opts: { v: string; l: string }[], allLabel = "— pick —") => (
    <div><label className="label">{label}</label><select className="input" value={value} onChange={e => onChange(e.target.value)}><option value="">{allLabel}</option>{opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
  );
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-white px-4 py-3">
        <button className="rounded-xl border px-3 py-2 font-bold md:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">☰ Menu</button>
        <Link href="/" className="flex items-center gap-2 font-extrabold"><img src="/logo.jpg" alt="U++ Academy" className="h-9 w-9 rounded-xl object-cover" /><span className="hidden sm:inline">U++ Academy</span></Link>
        <span className="ml-auto rounded-full bg-brand-tint px-3 py-1 text-xs font-extrabold capitalize text-brand-dark">{profile.role}</span>
        <button onClick={logout} className="hidden rounded-xl border px-3 py-2 text-sm font-bold md:block">Log out</button>
      </header>
      <div className="mx-auto flex max-w-7xl gap-5 px-4 py-5 pb-24 md:pb-5">
        <aside className="sticky top-[76px] hidden h-[calc(100vh-96px)] w-64 shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm md:block">{sidebar}</aside>
        <main className="min-w-0 flex-1">
          {msg && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{msg}</p>}
          {childProfile && <p className="mb-3 rounded-xl bg-brand-tint p-3 text-sm font-bold text-brand-dark">Parent view — showing your child {effectiveName}&rsquo;s fees, attendance, tests and assignments below.</p>}
          {cert && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-3xl border-4 border-amber-400 bg-white p-8 text-center shadow-xl">
            <img src="/logo.jpg" alt="U++ Academy" className="mx-auto mb-3 h-14 w-14 rounded-2xl object-cover" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-brand-dark">U++ Academy · {profile.institute_name || "U++ Academy"}</p>
            <h2 className="mt-2 text-3xl font-extrabold">Certificate of Achievement</h2>
            <p className="mt-4 text-sm text-slate-600">This certificate is awarded to</p>
            <p className="mt-1 text-2xl font-extrabold">{cert.student}</p>
            <p className="mt-3 text-sm text-slate-600">for scoring <b>{cert.marks} / {cert.total}</b> ({Math.round(cert.marks / (cert.total || 1) * 100)}%) in</p>
            <p className="mt-1 text-lg font-bold">{cert.test}</p>
            <p className="mt-3 text-xs text-slate-500">Date: {cert.date || new Date().toLocaleDateString()} · U++ Academy</p>
            <div className="mt-6 flex justify-center gap-2"><button onClick={() => window.print()} className="btn-brand !py-2.5 text-sm">Print certificate</button><button onClick={() => setCert(null)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Close</button></div>
          </div></div>}
          {section === "overview" && (() => {
            const today = new Date().toISOString().slice(0, 10);
            const monthKey = today.slice(0, 7);
            const myFees = (data.fees || []).filter(f => isStaff || s(f, "student_id") === effectiveId);
            const collectedMonth = myFees.filter(f => s(f, "status") === "paid" && (s(f, "paid_at") || s(f, "created_at") || "").startsWith(monthKey)).reduce((a, f) => a + n(f, "amount"), 0);
            const pendingFees = myFees.filter(f => s(f, "status") === "pending").reduce((a, f) => a + n(f, "amount"), 0);
            const attToday = (data.attendance || []).filter(a => s(a, "att_date") === today && (isStaff || s(a, "student_id") === effectiveId));
            const attPct = attToday.length ? Math.round(attToday.filter(a => s(a, "status") === "present").length / attToday.length * 100) : 0;
            const newLeads = (data.enquiries || []).filter(q => !s(q, "status") || s(q, "status") === "new").length;
            const upcoming = (data.live_classes || []).filter(c => s(c, "starts_at") && new Date(s(c, "starts_at")) >= new Date()).sort((a, b) => s(a, "starts_at").localeCompare(s(b, "starts_at"))).slice(0, 3);
            const absentToday = attToday.filter(a => s(a, "status") === "absent");
            const overdueFees = myFees.filter(f => s(f, "status") === "pending");
            const pendingReqs = (data.teacher_requests || []).filter(r => s(r, "status") === "pending");
            const openDoubts = (data.doubts || []).filter(d => s(d, "status") === "open");
            // ---- Student / Parent overview: only the student's own real data ----
            // No institute-wide KPIs here (total students, leads, teacher
            // requests are Admin numbers and never belonged on a student page).
            if (profile.role === "student" || profile.role === "parent") {
              const myEnrols = (data.enrollments || []).filter(e => s(e, "student_id") === effectiveId);
              const myBatches = myEnrols.map(e => batches.find(b => s(b, "id") === s(e, "batch_id"))).filter(Boolean) as Row[];
              const upcomingLive = (data.live_classes || []).filter(c => s(c, "starts_at") && new Date(s(c, "starts_at")) >= new Date()).sort((a, b) => s(a, "starts_at").localeCompare(s(b, "starts_at"))).slice(0, 3);
              const recentLectures = (data.lectures || []).slice(0, 3);
              const pendingAsg = (data.assignments || []).filter(a => !(data.submissions || []).some(x => s(x, "assignment_id") === s(a, "id") && s(x, "student_id") === effectiveId)).slice(0, 5);
              const myQs = (data.doubt_questions || []).filter(q => s(q, "student_id") === effectiveId);
              const answeredMine = myQs.filter(q => s(q, "status") !== "open");
              const recentAnn = (data.announcements || []).slice(0, 3);
              const myPays = (data.payments || []).filter(p => s(p, "student_id") === effectiveId);
              const lastPay = myPays[0];
              const myAtt = (data.attendance || []).filter(a => s(a, "student_id") === effectiveId);
              const attPct = myAtt.length ? Math.round(myAtt.filter(a => s(a, "status") === "present").length / myAtt.length * 100) : null;
              return (
              <div>
                <div className="rounded-3xl bg-gradient-to-r from-brand to-brand-dark p-6 text-white">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Welcome back · U++ Academy</p>
                  <h1 className="mt-1 text-2xl font-extrabold">Namaste, {effectiveName.split(" ")[0] || profile.full_name.split(" ")[0]} 👋</h1>
                  <p className="mt-1 text-sm opacity-90">{myBatches.length ? `You are enrolled in ${myBatches.length} batch${myBatches.length > 1 ? "es" : ""}.` : "You are not enrolled in any batch yet — explore batches below to start learning."}{attPct !== null ? ` Your attendance so far: ${attPct}%.` : ""}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-white/15 p-3"><b className="text-2xl">{myBatches.length}</b><span className="block text-xs font-bold opacity-80">My Batches</span></div>
                    <div className="rounded-2xl bg-white/15 p-3"><b className="text-2xl">{pendingAsg.length}</b><span className="block text-xs font-bold opacity-80">Pending Assignments</span></div>
                    <div className="rounded-2xl bg-white/15 p-3"><b className="text-2xl">{(data.doubt_questions || []).filter(q => s(q, "status") === "open").length}</b><span className="block text-xs font-bold opacity-80">Open Doubts</span></div>
                    <div className="rounded-2xl bg-white/15 p-3"><b className="text-2xl">{attPct !== null ? `${attPct}%` : "—"}</b><span className="block text-xs font-bold opacity-80">My Attendance</span></div>
                  </div>
                </div>
                <div className="card mt-5"><div className="flex items-center justify-between"><h3 className="font-extrabold">Currently enrolled batches</h3><button onClick={() => { setBatchTab("all"); openSection("batches"); }} className="text-xs font-bold text-brand-dark">Browse all batches →</button></div>
                  {myBatches.length === 0 ? <p className="mt-2 text-sm text-slate-500">No batches yet — explore batches, pick a plan and pay via Cashfree to start learning.</p> : <ul className="mt-2 space-y-2 text-sm">{myBatches.map(b => { const sub = mySubs.find(x => s(x, "batch_id") === s(b, "id")); const st = sub ? subStatus(sub) : "active"; return <li key={s(b, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><span><b>{s(b, "name")}</b> · {s(b, "class_label")} · {s(b, "subject")}</span><span className="flex items-center gap-2 text-xs font-bold text-slate-500">{sub ? `${s(sub, "plan_name") || "Plan"} · Valid until ${s(sub, "valid_until") || "—"}` : "Enrolled"}{st === "expired" && <button onClick={() => { setBatchTab("mine"); openSection("batches"); }} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-extrabold text-white">Renew →</button>}</span></li>; })}</ul>}
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Upcoming live classes</h3>
                  {upcomingLive.length === 0 ? <p className="mt-2 text-sm text-slate-500">No live classes scheduled ahead.</p> : <ul className="mt-2 space-y-1 text-sm">{upcomingLive.map(c => <li key={s(c, "id")} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span><b>{s(c, "title")}</b> · {s(c, "subject")}</span><span className="text-slate-500">{new Date(s(c, "starts_at")).toLocaleString()}</span></li>)}</ul>}
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Recently uploaded lectures</h3>
                  {recentLectures.length === 0 ? <p className="mt-2 text-sm text-slate-500">No lectures in your batches yet.</p> : <ul className="mt-2 space-y-1 text-sm">{recentLectures.map(l => <li key={s(l, "id")} className="rounded-lg bg-slate-50 px-3 py-2"><b>{s(l, "title")}</b> · {batchName(s(l, "batch_id"))} · {s(l, "subject")}</li>)}</ul>}
                  <button onClick={() => openSection("lectures")} className="mt-2 text-xs font-bold text-brand-dark">All recorded lectures →</button>
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Pending assignments</h3>
                  {pendingAsg.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nothing pending — you are all caught up.</p> : <ul className="mt-2 space-y-1 text-sm">{pendingAsg.map(a => <li key={s(a, "id")} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span><b>{s(a, "title")}</b> · {s(a, "subject")}</span><span className="text-slate-500">Due {s(a, "due_date") || "—"}</span></li>)}</ul>}
                  <button onClick={() => openSection("assignments")} className="mt-2 text-xs font-bold text-brand-dark">Go to Assignments →</button>
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Recently answered doubts</h3>
                  {answeredMine.length === 0 ? <p className="mt-2 text-sm text-slate-500">{myQs.length === 0 ? "You have not asked any doubt yet." : "Your doubts are still waiting for an answer."}</p> : <ul className="mt-2 space-y-1 text-sm">{answeredMine.slice(0, 3).map(q => <li key={s(q, "id")} className="rounded-lg bg-slate-50 px-3 py-2"><b>{s(q, "title")}</b> · {forumAnswers(s(q, "id")).length} answer(s) · {s(q, "status")}</li>)}</ul>}
                  <button onClick={() => openSection("doubts")} className="mt-2 text-xs font-bold text-brand-dark">Open Doubt Forum →</button>
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Recent announcements</h3>
                  {recentAnn.length === 0 ? <p className="mt-2 text-sm text-slate-500">No announcements yet.</p> : <ul className="mt-2 space-y-1 text-sm">{recentAnn.map(a => <li key={s(a, "id")} className="rounded-lg bg-slate-50 px-3 py-2"><b>{s(a, "title")}</b> — {s(a, "body")}</li>)}</ul>}
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Payment status</h3>
                  {myPays.length === 0 ? <p className="mt-2 text-sm text-slate-500">No payments yet. Buy a batch plan to see it here.</p> : <p className="mt-2 text-sm">Latest payment: <b>₹{String(lastPay.amount)}</b> for {batchName(s(lastPay, "batch_id"))} — <b className="capitalize">{s(lastPay, "status")}</b> · Order {s(lastPay, "order_id")}</p>}
                  <button onClick={() => openSection("fees")} className="mt-2 text-xs font-bold text-brand-dark">My Payments →</button>
                </div>
                <h2 className="mb-3 mt-6 font-extrabold">Jump to</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["lectures","assignments","live_classes","doubts"].map(k => <button key={k} onClick={() => openSection(k)} className="card !p-4 text-left font-bold hover:border-brand">{sectionLabel(k)}</button>)}
                </div>
                <div className="card mt-5"><h3 className="font-extrabold">Getting started</h3><p className="mt-1 text-sm text-slate-600">Your Admin will add you to a batch. Once enrolled, lectures, assignments and tests appear here. Fees are paid online via Cashfree; until then, pay at the institute in cash/UPI and Admin confirms your enrolment.</p><InstallAppButton className="mt-3" /></div>
              </div>
              );
            }
            const kpis: [string, string][] = [
              ["Total Students", String(isStaff ? students.length : 1)],
              ["Fees Collected This Month", `₹${collectedMonth}`],
              ["Fees Due / Pending", `₹${pendingFees}`],
              ["Attendance Today", attToday.length ? `${attPct}%` : "—"],
              ["New Leads", String(newLeads)],
              ["Pending Doubts", String(openDoubts.length)],
            ];
            return (
            <div>
              <div className="rounded-3xl bg-gradient-to-r from-brand to-brand-dark p-6 text-white">
                <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Today · U++ Academy</p>
                <h1 className="mt-1 text-2xl font-extrabold">Namaste, {profile.full_name.split(" ")[0]} — here is your institute today.</h1>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {kpis.map(([l, v]) => <div key={l} className="rounded-2xl bg-white/15 p-3"><b className="text-2xl">{v}</b><span className="block text-xs font-bold opacity-80">{l}</span></div>)}
                </div>
              </div>
              <div className="card mt-5"><h3 className="font-extrabold">Upcoming live classes</h3>
                {upcoming.length === 0 ? <p className="mt-2 text-sm text-slate-500">No live classes scheduled ahead. Schedule one in Live Classes.</p> : <ul className="mt-2 space-y-1 text-sm">{upcoming.map(c => <li key={s(c, "id")} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span><b>{s(c, "title")}</b> · {s(c, "subject")}</span><span className="text-slate-500">{new Date(s(c, "starts_at")).toLocaleString()}</span></li>)}</ul>}
              </div>
              <div className="card mt-5"><h3 className="font-extrabold">To-do — needs your attention</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-center justify-between gap-2 rounded-xl border p-3"><span>Absent today: <b>{absentToday.length}</b>{absentToday.length ? ` — ${absentToday.map(a => nameOf(s(a, "student_id"))).join(", ")}` : ""}</span><button onClick={() => openSection("attendance")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Attendance →</button></li>
                  <li className="flex items-center justify-between gap-2 rounded-xl border p-3"><span>Overdue / pending fees: <b>{overdueFees.length}</b> (₹{pendingFees})</span><button onClick={() => openSection("fees")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Fees →</button></li>
                  {profile.role === "admin" && <li className="flex items-center justify-between gap-2 rounded-xl border p-3"><span>Pending teacher requests: <b>{pendingReqs.length}</b></span><button onClick={() => openSection("users")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Users →</button></li>}
                  <li className="flex items-center justify-between gap-2 rounded-xl border p-3"><span>Unanswered doubts: <b>{openDoubts.length}</b></span><button onClick={() => openSection("doubts")} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Doubts →</button></li>
                </ul>
              </div>
              <h2 className="mb-3 mt-6 font-extrabold">Jump to</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {JUMP_TO.filter(k => allowedSections(profile.role).includes(k) && isEnabled(k)).map(k => { const i = FEATURE_KEYS.indexOf(k as never); return <button key={k} onClick={() => openSection(k)} className="card !p-4 text-left font-bold hover:border-brand">{sectionLabel(k)}</button>; })}
              </div>
              <div className="card mt-5"><h3 className="font-extrabold">Getting started</h3><p className="mt-1 text-sm text-slate-600">This academy starts empty. {profile.role === "admin" ? "Create your first batch in Batches, add teachers/students in Users, then publish lectures and assignments." : "Your Admin will add you to a batch. Once enrolled, lectures, assignments and tests appear here."} Fees are paid online via Cashfree when Admin has added the Cashfree keys in Vercel; until then, pay at the institute in cash/UPI and Admin confirms your enrolment.</p><InstallAppButton className="mt-3" /></div>
            </div>
            );
          })()}

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
                <div className="card"><h2 className="text-xl font-extrabold">{sectionLabel(section)}</h2><p className="mt-2 text-sm text-slate-600">{!sectionAllowed ? "This section is not available for your role. Reports, user management and permissions belong to the Admin / Teacher dashboard." : sectionAdminOnly ? "This section is Admin-only." : "This feature is switched Off for your role. Ask an Admin to turn it on in Dashboard > Permissions."}</p><button onClick={() => openSection("overview")} className="btn-brand mt-3 !py-2 text-sm">Back to Overview</button></div>
              ) : section === "permissions" ? (
                <div className="card"><h2 className="text-xl font-extrabold">Role Permissions — 14 features</h2><p className="mt-1 text-sm text-slate-600">Admin only. Toggle a feature for a role. Students, teachers and parents will see disabled features tagged “Off” in their sidebar.</p>
                  
        <div className="mt-4 space-y-2">{perms.map(p => <div key={String(p.id)} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="font-bold capitalize">{String(p.role)} · {String(p.feature_key)}</span><button onClick={() => togglePerm(p)} disabled={profile.role!=="admin"} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${p.enabled ? "bg-brand text-white" : "bg-slate-200"}`}>{p.enabled ? "On" : "Off"}</button></div>)}</div>
                  {perms.length===0 && <p className="mt-3 text-sm text-slate-500">No permission rows yet — run supabase/schema.sql in your Supabase project, it seeds all 14 features × 4 roles.</p>}
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-extrabold">{sectionLabel(section)}</h2>
                  {dataLoading && <p className="mt-2 text-sm text-slate-400">Loading…</p>}
                  {renderSection()}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {drawer && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setDrawer(false)} /><aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl">{sidebar}</aside></div>}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden">
        {(profile.role === "student" || profile.role === "parent" ? ["overview","batches","lectures","doubts"] : ["overview","batches","lectures","assignments"]).map(k => { const label = k==="overview" ? "Home" : k==="batches" ? (profile.role === "student" ? "My Batches" : "Batches") : k==="lectures" ? "Learn" : k==="doubts" ? "Doubt" : "Tasks"; return <button key={k} onClick={()=>openSection(k)} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${section===k ? "text-brand" : "text-slate-400"}`}>{k==="overview"?"🏠":k==="batches"?"📚":k==="lectures"?"▶":k==="doubts"?"💬":"✏"}{label}</button>; })}
        <button onClick={()=>setMoreOpen(true)} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold ${moreOpen ? "text-brand" : "text-slate-400"}`}>⋯ More</button>
      </nav>
      {moreOpen && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setMoreOpen(false)} /><div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-8"><div className="mb-3 flex items-center justify-between"><b>All sections</b><button onClick={()=>setMoreOpen(false)} className="rounded-lg border px-3 py-1 font-bold">Close</button></div><div className="grid grid-cols-3 gap-2">{allowedSections(profile.role).map((k)=>(<button key={k} onClick={()=>openSection(k)} className="rounded-2xl border p-3 text-center text-xs font-bold">{sectionLabel(k)}{!isEnabled(k) && <span className="mt-1 block text-[10px] text-accent-ink">Off</span>}</button>))}</div><button onClick={logout} className="mt-4 w-full rounded-xl border py-3 font-bold text-red-700">Log out</button></div></div>}
    </div>
  );

  // ---------- per-section renderers (defined after return for readability; hoisted function) ----------
  function renderSection() {
    const empty = (t: string) => <div className="card mt-3 text-sm text-slate-500">{t}</div>;
    if (section === "batches") return (
      <div>
        {profile?.role === "admin" && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Create batch</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Batch name</label><input required className="input" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Class (e.g. Class 10)</label><input required className="input" value={form.class_label || ""} onChange={e => setForm({ ...form, class_label: e.target.value })} /></div>
          <div><label className="label">Board</label><input className="input" value={form.board || ""} onChange={e => setForm({ ...form, board: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          {sel("Teacher", form.teacher_id || "", v => setForm({ ...form, teacher_id: v }), teachers.map(t => ({ v: s(t, "id"), l: `${s(t, "full_name")} — ${s(t, "subject")}` })))}
          <div><label className="label">Price (₹, 0 = free)</label><input type="number" className="input" value={form.price || ""} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. 2000" /></div>
          <div><label className="label">Capacity (seats, blank = unlimited)</label><input type="number" className="input" value={form.capacity || ""} onChange={e => setForm({ ...form, capacity: e.target.value })} /></div>
          {sel("Status", form.status || "active", v => setForm({ ...form, status: v }), [{ v: "active", l: "Active — open for enrolment" }, { v: "upcoming", l: "Upcoming" }, { v: "closed", l: "Closed" }])}
          <div className="sm:col-span-2"><label className="label">Description — what this batch covers (shown on the batch card)</label><textarea rows={3} className="input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Complete Class 10 Maths + Science with live classes, recorded lectures, weekly tests and doubt support." /></div>
          <div className="sm:col-span-2"><label className="label">Thumbnail — cover image (JPG / PNG / WebP, up to 5 MB)</label>
            {s(form, "thumbnail_url") ? <div className="mb-2 flex items-start gap-3"><img src={s(form, "thumbnail_url")} alt="Batch thumbnail preview" className="aspect-video w-40 rounded-xl object-cover" /><button type="button" onClick={() => setForm({ ...form, thumbnail_url: "" })} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-red-700">Remove</button></div> : null}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={e => { const f = e.target.files?.[0]; void onThumbPicked(f, url => setForm(prev => ({ ...prev, thumbnail_url: url }))); e.target.value = ""; }} />
            <input className="input mt-2" value={form.thumbnail_url || ""} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="…or paste an image URL instead" />
            {thumbUploading && <p className="mt-1 text-xs font-bold text-brand-dark">Uploading thumbnail…</p>}
            {thumbError && <p className="mt-1 text-xs font-bold text-red-700">{thumbError}</p>}
          </div>
          <div className="sm:col-span-2"><label className="label">Demo lecture PDF — free preview students can open before buying (PDF, up to 10 MB)</label>
            {s(form, "demo_pdf_url") ? <div className="mb-2 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold">{demoFileName(s(form, "demo_pdf_url"))}</span><a href={s(form, "demo_pdf_url")} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-dark underline">Open demo PDF ↗</a><button type="button" onClick={() => setForm({ ...form, demo_pdf_url: "" })} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-red-700">Remove</button></div> : null}
            <input type="file" accept="application/pdf" className="input" onChange={e => { const f = e.target.files?.[0]; void onDemoPdfPicked(f, url => setForm(prev => ({ ...prev, demo_pdf_url: url }))); e.target.value = ""; }} />
            <input className="input mt-2" value={form.demo_pdf_url || ""} onChange={e => setForm({ ...form, demo_pdf_url: e.target.value })} placeholder="…or paste a PDF URL instead" />
            {demoUploading && <p className="mt-1 text-xs font-bold text-brand-dark">Uploading demo PDF…</p>}
            {demoError && <p className="mt-1 text-xs font-bold text-red-700">{demoError}</p>}
          </div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save batch</button></form>}
        {isStaff && <div className="card mt-3"><h3 className="font-extrabold">Enrol a student into a batch</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
          {sel("Batch", enrolBatch, setEnrolBatch, (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          {sel("Student", enrolStudent, setEnrolStudent, students.map(t => ({ v: s(t, "id"), l: `${s(t, "full_name")} (${s(t, "class_label")})` })))}
          <div className="flex items-end"><button onClick={enrol} className="btn-brand !py-2.5 text-sm">Enrol</button></div>
        </div></div>}
        {isStaff && <div className="card mt-3"><h3 className="font-extrabold">Subscription plans — Physics Wallah style</h3>
          <p className="mt-1 text-sm text-slate-600">Create a plan per batch (Monthly / Quarterly / Half-Yearly / Yearly / Full Course). Students pick a plan on the batch card and pay that price via Cashfree — the MRP is shown struck through with the discount %.</p>
          <form onSubmit={createPlan} className="mt-3 grid gap-3 sm:grid-cols-3">
            {sel("Batch", planBatch, setPlanBatch, (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
            <div><label className="label">Plan name</label><input required className="input" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Monthly / Quarterly / Yearly / Full Course" /></div>
            <div><label className="label">Price (₹)</label><input required type="number" className="input" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} /></div>
            <div><label className="label">MRP (₹, struck through — optional)</label><input type="number" className="input" value={planForm.mrp} onChange={e => setPlanForm({ ...planForm, mrp: e.target.value })} /></div>
            <div><label className="label">Validity (days)</label><input required type="number" className="input" value={planForm.duration_days} onChange={e => setPlanForm({ ...planForm, duration_days: e.target.value })} /></div>
            <div className="flex flex-wrap items-end gap-2">{[30, 90, 180, 365, 9999].map(d => <button key={d} type="button" onClick={() => setPlanForm({ ...planForm, duration_days: String(d), name: d === 30 ? "Monthly" : d === 90 ? "Quarterly" : d === 180 ? "Half-Yearly" : d === 365 ? "Yearly" : "Full Course" })} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${planForm.duration_days === String(d) ? "bg-brand text-white" : "bg-slate-200"}`}>{d === 9999 ? "Full Course" : `${d}d`}</button>)}</div>
            <div className="sm:col-span-2"><label className="label">Features (what this plan includes)</label><input className="input" value={planForm.features} onChange={e => setPlanForm({ ...planForm, features: e.target.value })} placeholder="e.g. Live classes + recorded lectures + test series" /></div>
            <div className="flex items-end"><button className="btn-brand !py-2.5 text-sm">Save plan</button></div>
          </form>
          <div className="mt-3 space-y-2">
            {(data.batch_plans || []).length === 0 && <p className="text-sm text-slate-500">No plans yet — create one above. Until a plan exists, students pay the batch price shown on the batch card.</p>}
            {(data.batch_plans || []).map(pl => <div key={s(pl, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span><b>{s(pl, "name")}</b> — {batchName(s(pl, "batch_id"))} · ₹{String(pl.price)}{n(pl, "mrp") > 0 ? <span className="ml-1 text-slate-400 line-through">₹{String(pl.mrp)}</span> : ""}{planDiscount(pl) ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">{planDiscount(pl)}% OFF</span> : ""} · {planValidity(pl)}{s(pl, "features") ? ` · ${s(pl, "features")}` : ""}</span><span className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${String(pl.is_active) === "false" ? "bg-slate-200" : "bg-brand-tint text-brand-dark"}`}>{String(pl.is_active) === "false" ? "Inactive" : "Active"}</span><button onClick={() => togglePlan(pl)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">{String(pl.is_active) === "false" ? "Activate" : "Deactivate"}</button></span></div>)}
          </div>
        </div>}
        {isStaff && <div className="card mt-3"><h3 className="font-extrabold">Subscriptions</h3>
          <p className="mt-1 text-sm text-slate-600">Who bought which plan, for how much, and until when. Status is computed from valid until vs today.</p>
          <div className="mt-3 space-y-2">
            {(data.subscriptions || []).length === 0 && <p className="text-sm text-slate-500">No subscriptions yet — they appear here once a student pays for a plan (or enrols in a free plan).</p>}
            {(data.subscriptions || []).map(x => { const st = subStatus(x); return <div key={s(x, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span><b>{nameOf(s(x, "student_id"))}</b> — {batchName(s(x, "batch_id"))} · {s(x, "plan_name") || "Plan"} · ₹{String(x.amount_paid ?? 0)} · Valid {s(x, "valid_from")} → {s(x, "valid_until") || "—"}{s(x, "order_id") ? ` · Order ${s(x, "order_id")}` : ""}</span><span className={`rounded-full px-2 py-1 text-xs font-extrabold ${st === "active" ? "bg-brand-tint text-brand-dark" : "bg-red-100 text-red-700"}`}>{st}</span></div>; })}
          </div>
        </div>}
        <div className="card mt-3"><h3 className="font-extrabold">Courses — recorded courses, bundles &amp; pricing</h3>
          <p className="mt-1 text-sm text-slate-600">Create paid or free courses and enrol students into them (with a coupon code for a discount). A bundle groups courses under one name, e.g. “Board Excellence Pack”.</p>
          {isStaff && <form onSubmit={createCourse} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Course title</label><input required className="input" value={courseForm.title} onChange={e => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
            {sel("Class", courseForm.class_label, v => setCourseForm({ ...courseForm, class_label: v }), ["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"].map(c => ({ v: c, l: c })))}
            <div><label className="label">Subject</label><input className="input" value={courseForm.subject} onChange={e => setCourseForm({ ...courseForm, subject: e.target.value })} /></div>
            <div><label className="label">Price (₹, 0 = free)</label><input type="number" className="input" value={courseForm.price} onChange={e => setCourseForm({ ...courseForm, price: e.target.value })} /></div>
            <div><label className="label">Bundle name (optional)</label><input className="input" value={courseForm.bundle_name} onChange={e => setCourseForm({ ...courseForm, bundle_name: e.target.value })} placeholder="e.g. Board Excellence Pack" /></div>
            <div className="flex items-end gap-2"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={courseForm.is_paid} onChange={e => setCourseForm({ ...courseForm, is_paid: e.target.checked })} /> Paid course</label></div>
            <div className="sm:col-span-2"><label className="label">Description</label><input className="input" value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} /></div>
            <div className="sm:col-span-2"><button className="btn-brand !py-2.5 text-sm">Save course</button></div>
          </form>}
          {isStaff && <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {sel("Course", courseId, setCourseId, (data.courses || []).map(c => ({ v: s(c, "id"), l: `${s(c, "title")} — ₹${String(c.price ?? 0)}` })))}
            {sel("Student", courseStu, setCourseStu, students.map(x => ({ v: s(x, "id"), l: s(x, "full_name") })))}
            <div><label className="label">Coupon code (optional)</label><input className="input" value={courseCoupon} onChange={e => setCourseCoupon(e.target.value)} placeholder="e.g. UPLUS10" /></div>
            <div className="flex items-end"><button onClick={enrolCourse} className="btn-brand !py-2.5 text-sm">Enrol into course</button></div>
          </div>}
          <div className="mt-3 space-y-2">
            {(data.courses || []).length === 0 && <p className="text-sm text-slate-500">No courses yet.</p>}
            {(data.courses || []).map(c => { const enrolled = (data.course_enrollments || []).filter(e => s(e, "course_id") === s(c, "id")); const myCourse = enrolled.some(e => s(e, "student_id") === effectiveId); return <div key={s(c, "id")} className="rounded-xl border p-3 text-sm"><b>{s(c, "title")}</b> — {s(c, "class_label")} · {s(c, "subject")}{s(c, "bundle_name") ? ` · Bundle: ${s(c, "bundle_name")}` : ""} · {s(c, "is_paid") === "true" ? `₹${String(c.price ?? 0)} (paid)` : "Free"} · {enrolled.length} enrolled{s(c, "description") ? ` · ${s(c, "description")}` : ""}{!isStaff && myCourse && <span className="ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-extrabold text-brand-dark">✓ Enrolled</span>}<p className="text-xs text-slate-500">{isStaff ? (enrolled.length ? enrolled.map(e => `${nameOf(s(e, "student_id"))} (₹${String(e.price_paid ?? 0)}${s(e, "coupon_code") ? `, coupon ${s(e, "coupon_code")}` : ""})`).join(", ") : "Nobody enrolled yet.") : ""}</p></div>; })}
          </div>
        </div>
{profile?.role === "admin" && editingBatch && <form onSubmit={saveEditBatch} className="card mt-3 border-2 border-brand"><h3 className="font-extrabold">Edit batch — {s(editingBatch, "name")}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Batch name</label><input required className="input" value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><label className="label">Class (e.g. Class 10)</label><input required className="input" value={editForm.class_label || ""} onChange={e => setEditForm({ ...editForm, class_label: e.target.value })} /></div>
          <div><label className="label">Board</label><input className="input" value={editForm.board || ""} onChange={e => setEditForm({ ...editForm, board: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={editForm.subject || ""} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} /></div>
          {sel("Teacher", editForm.teacher_id || "", v => setEditForm({ ...editForm, teacher_id: v }), teachers.map(t => ({ v: s(t, "id"), l: `${s(t, "full_name")} — ${s(t, "subject")}` })))}
          <div><label className="label">Price (₹, 0 = free)</label><input type="number" className="input" value={editForm.price || ""} onChange={e => setEditForm({ ...editForm, price: e.target.value })} /></div>
          <div><label className="label">Capacity (seats, blank = unlimited)</label><input type="number" className="input" value={editForm.capacity || ""} onChange={e => setEditForm({ ...editForm, capacity: e.target.value })} /></div>
          {sel("Status", editForm.status || "active", v => setEditForm({ ...editForm, status: v }), [{ v: "active", l: "Active — open for enrolment" }, { v: "upcoming", l: "Upcoming" }, { v: "closed", l: "Closed" }])}
          <div className="sm:col-span-2"><label className="label">Description — what this batch covers (shown on the batch card)</label><textarea rows={3} className="input" value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="e.g. Complete Class 10 Maths + Science with live classes, recorded lectures, weekly tests and doubt support." /></div>
          <div className="sm:col-span-2"><label className="label">Thumbnail — cover image (JPG / PNG / WebP, up to 5 MB)</label>
            {s(editForm, "thumbnail_url") ? <div className="mb-2 flex items-start gap-3"><img src={s(editForm, "thumbnail_url")} alt="Batch thumbnail preview" className="aspect-video w-40 rounded-xl object-cover" /><button type="button" onClick={() => setEditForm({ ...editForm, thumbnail_url: "" })} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-red-700">Remove</button></div> : null}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={e => { const f = e.target.files?.[0]; void onThumbPicked(f, url => setEditForm(prev => ({ ...prev, thumbnail_url: url }))); e.target.value = ""; }} />
            <input className="input mt-2" value={editForm.thumbnail_url || ""} onChange={e => setEditForm({ ...editForm, thumbnail_url: e.target.value })} placeholder="…or paste an image URL instead" />
            {thumbUploading && <p className="mt-1 text-xs font-bold text-brand-dark">Uploading thumbnail…</p>}
            {thumbError && <p className="mt-1 text-xs font-bold text-red-700">{thumbError}</p>}
          </div>
          <div className="sm:col-span-2"><label className="label">Demo lecture PDF — free preview students can open before buying (PDF, up to 10 MB)</label>
            {s(editForm, "demo_pdf_url") ? <div className="mb-2 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold">{demoFileName(s(editForm, "demo_pdf_url"))}</span><a href={s(editForm, "demo_pdf_url")} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-dark underline">Open demo PDF ↗</a><button type="button" onClick={() => setEditForm({ ...editForm, demo_pdf_url: "" })} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-red-700">Remove</button></div> : null}
            <input type="file" accept="application/pdf" className="input" onChange={e => { const f = e.target.files?.[0]; void onDemoPdfPicked(f, url => setEditForm(prev => ({ ...prev, demo_pdf_url: url }))); e.target.value = ""; }} />
            <input className="input mt-2" value={editForm.demo_pdf_url || ""} onChange={e => setEditForm({ ...editForm, demo_pdf_url: e.target.value })} placeholder="…or paste a PDF URL instead" />
            {demoUploading && <p className="mt-1 text-xs font-bold text-brand-dark">Uploading demo PDF…</p>}
            {demoError && <p className="mt-1 text-xs font-bold text-red-700">{demoError}</p>}
          </div>
        </div><div className="mt-3 flex gap-2"><button className="btn-brand !py-2.5 text-sm">Save changes</button><button type="button" onClick={() => { setEditingBatch(null); setEditForm({}); setThumbError(""); }} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Cancel</button></div></form>}
        {!isStaff && <div className="card mt-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Batches">
            {(["all", "mine"] as const).map(tb => <button key={tb} role="tab" aria-selected={batchTab === tb} onClick={() => setBatchTab(tb)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${batchTab === tb ? "bg-brand text-white" : "bg-slate-200"}`}>{tb === "all" ? `All Batches (${filteredCatalog.length})` : `My Batches (${myBatchesList.length})`}</button>)}
          </div>
          {batchTab === "all" && <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Search batches by name, subject or class…" value={batchSearch} onChange={e => setBatchSearch(e.target.value)} />
            <select className="input" value={batchClass} onChange={e => setBatchClass(e.target.value)}><option value="">All classes</option>{classOptions.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>}
          <p className="mt-2 text-xs text-slate-500">{batchTab === "all" ? "Every batch open for enrolment. Buy a plan to start learning — a batch only moves to My Batches after Cashfree confirms your payment." : "Only batches you are enrolled in. Access stays active while your plan is valid; renew an expired plan from its card."}</p>
        </div>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {isStaff && batches.length === 0 && empty("No batches yet — create your first batch above.")}
          {!isStaff && batchTab === "mine" && myBatchesList.length === 0 && <div className="card text-sm text-slate-600 sm:col-span-2">You are not enrolled in any batch yet. <button onClick={() => setBatchTab("all")} className="font-bold text-brand-dark underline">Browse all batches →</button></div>}
          {!isStaff && batchTab === "all" && filteredCatalog.length === 0 && <div className="card text-sm text-slate-600 sm:col-span-2">No batches match that search. Try a different name, subject or class.</div>}
          {(isStaff ? batches : batchTab === "mine" ? myBatchesList : filteredCatalog).map(b => {
            const enrolled = (data.enrollments || []).filter(e => s(e, "batch_id") === s(b, "id"));
            const thumb = s(b, "thumbnail_url");
            const initials = s(b, "name").split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "U+";
            return <div key={s(b, "id")} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              {thumb ? <img src={thumb} alt={`${s(b, "name")} thumbnail`} className="aspect-video w-full object-cover" /> : <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-brand to-brand-dark"><span className="text-4xl font-extrabold tracking-wide text-white">{initials}</span></div>}
              <div className="p-4"><b className="text-base">{s(b, "name")}</b>
              <p className="mt-1 flex flex-wrap gap-1">{[s(b, "class_label"), s(b, "board"), s(b, "subject")].filter(Boolean).map(c => <span key={c} className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-extrabold text-brand-dark">{c}</span>)}<span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${(s(b, "status") || "active") === "active" ? "bg-brand-tint text-brand-dark" : "bg-slate-200 text-slate-600"}`}>{s(b, "status") || "active"}</span></p>
              {s(b, "description") && <p className={`mt-2 text-sm text-slate-600 ${expandedBatch === s(b, "id") ? "" : "line-clamp-2"}`}>{s(b, "description")}</p>}
              <p className="mt-2 text-xs text-slate-500">Teacher: {s(b, "teacher_id") ? nameOf(s(b, "teacher_id")) : "—"} · {enrolled.length} enrolled{s(b, "capacity") ? ` / ${s(b, "capacity")} seats` : ""} · <b className="text-sm text-ink">{n(b, "price") > 0 ? `₹${String(b.price)}` : "Free"}</b></p>
              {s(b, "demo_pdf_url") && <a href={s(b, "demo_pdf_url")} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-extrabold text-amber-800">📄 Free Demo Lecture — View Demo PDF ↗</a>}
              {!isStaff && <div className="mt-2"><button onClick={() => setExpandedBatch(expandedBatch === s(b, "id") ? "" : s(b, "id"))} className="text-xs font-bold text-brand-dark underline">{expandedBatch === s(b, "id") ? "Hide details ▲" : "View details ▾"}</button>
                {expandedBatch === s(b, "id") && <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <p><b>Teacher:</b> {s(b, "teacher_id") ? nameOf(s(b, "teacher_id")) : "—"} · <b>Class:</b> {s(b, "class_label")} · <b>Board:</b> {s(b, "board") || "—"} · <b>Subject:</b> {s(b, "subject") || "—"}</p>
                  <p><b>Enrolled:</b> {enrolled.length}{s(b, "capacity") ? ` / ${s(b, "capacity")} seats` : " (unlimited seats)"} · <b>Price:</b> {n(b, "price") > 0 ? `₹${String(b.price)}` : "Free"} · <b>Status:</b> {s(b, "status") || "active"}</p>
                  {(() => { const pls = (data.batch_plans || []).filter(x => s(x, "batch_id") === s(b, "id") && String(x.is_active) !== "false"); if (!pls.length) return <p>No plans yet — the batch price above applies.</p>; return <div><b>Plans:</b><ul className="mt-1 space-y-1">{pls.map(pl => <li key={s(pl, "id")}>· {s(pl, "name")} — ₹{String(pl.price)}{n(pl, "mrp") > 0 ? <span className="text-slate-400 line-through"> ₹{String(pl.mrp)}</span> : ""} · {planValidity(pl)}{s(pl, "features") ? ` · ${s(pl, "features")}` : ""}</li>)}</ul></div>; })()}
                </div>}
              </div>}
              {!isStaff && (() => {
                const bid = s(b, "id");
                const mine = enrolled.some(e => s(e, "student_id") === effectiveId);
                const full = s(b, "capacity") && enrolled.length >= n(b, "capacity");
                const closed = (s(b, "status") || "active") !== "active";
                const plans = (data.batch_plans || []).filter(x => s(x, "batch_id") === bid && String(x.is_active) !== "false");
                const mySub = mySubs.find(x => s(x, "batch_id") === bid && subStatus(x) === "active") || mySubs.find(x => s(x, "batch_id") === bid);
                const selId = selPlan[bid] || (plans[0] ? s(plans[0], "id") : "");
                const sel = plans.find(x => s(x, "id") === selId);
                // My Batches tab: enrolled-only card. Enrolment date comes
                // from the enrollments row; access from the subscription
                // (a grandfathered enrolment without one is Active);
                // "duration" is the bought plan's validity — batches have
                // no duration/start-date column. Progress is tasks done
                // vs tasks set (see batchProgress).
                if (batchTab === "mine") {
                  const enr = myEnrols.find(e => s(e, "batch_id") === bid);
                  const prog = batchProgress(bid);
                  const expired = !!(mySub && subStatus(mySub) === "expired");
                  const boughtPlan = (data.batch_plans || []).find(x => s(x, "id") === s(mySub, "plan_id") || s(x, "id") === s(enr, "plan_id"));
                  return <div className="mt-2 space-y-2">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                      <span className={`rounded-full px-2 py-1 ${expired ? "bg-red-100 text-red-700" : "bg-brand-tint text-brand-dark"}`}>{expired ? "Expired" : "✓ Active"}</span>
                      <span>Enrolled {enr && s(enr, "created_at") ? new Date(s(enr, "created_at")).toLocaleDateString() : "—"}</span>
                      {mySub && <span>{s(mySub, "plan_name") || "Plan"} · Valid until {s(mySub, "valid_until") || "—"}</span>}
                      {boughtPlan && <span>· {planValidity(boughtPlan)}</span>}
                    </p>
                    {prog ? <div><p className="text-xs font-bold text-slate-600">Learning progress — {prog.done} of {prog.total} tasks done ({Math.round(prog.done / prog.total * 100)}%)</p><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(prog.done / prog.total * 100)}%` }} /></div><p className="mt-1 text-[11px] text-slate-500">Tasks = assignments submitted + tests attempted in this batch.</p></div> : <p className="text-xs text-slate-500">Progress tracking coming soon — complete assignments and tests in this batch and your progress will show here.</p>}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setLearnBatch(bid); openSection("lectures"); }} disabled={!activeBatchIds.has(bid)} className="btn-brand !py-2 text-xs">Continue Learning →</button>
                      {expired && <button onClick={() => payAndEnrol(bid, selId || undefined)} disabled={payBusy === bid} className="btn-brand !py-2 text-xs">{payBusy === bid ? "Starting payment…" : `Renew — Pay ₹${sel ? String(sel.price) : String(b.price)} via Cashfree`}</button>}
                    </div>
                  </div>;
                }
                // Root cause (audit #3): an enrolment with no subscription
                // row (Admin/manual enrol, or a free enrol before plans
                // existed) fell through to the "Pay again" button even
                // though the student was already enrolled. An enrolment
                // row is the source of truth — it means enrolled.
                if (mine && !mySub) return <div className="mt-2"><span className="inline-block rounded-full bg-brand-tint px-3 py-1.5 text-xs font-extrabold text-brand-dark">✓ Enrolled</span></div>;
                if (mine && mySub && subStatus(mySub) === "active") return <div className="mt-2"><span className="inline-block rounded-full bg-brand-tint px-3 py-1.5 text-xs font-extrabold text-brand-dark">✓ Enrolled — {s(mySub, "plan_name") || "Batch"} · Valid until {s(mySub, "valid_until") || "—"}</span></div>;
                if (mine && mySub && subStatus(mySub) === "expired") return <div className="mt-2"><span className="inline-block rounded-full bg-red-100 px-3 py-1.5 text-xs font-extrabold text-red-700">Subscription expired {s(mySub, "valid_until")}</span><button onClick={() => payAndEnrol(bid, selId || undefined)} disabled={payBusy === bid} className="btn-brand ml-2 !py-2 text-xs">Renew — Pay ₹{sel ? String(sel.price) : String(b.price)} via Cashfree</button></div>;
                if (full) return <span className="mt-2 inline-block rounded-full bg-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-500">Batch full</span>;
                if (closed) return <span className="mt-2 inline-block rounded-full bg-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-500">Enrolment {s(b, "status")}</span>;
                return <div className="mt-2">
                  {plans.length > 0 ? <div className="grid gap-2 sm:grid-cols-3">{plans.map(pl => { const pid = s(pl, "id"); const disc = planDiscount(pl); return <button key={pid} onClick={() => setSelPlan({ ...selPlan, [bid]: pid })} className={`rounded-2xl border-2 p-3 text-left ${selId === pid ? "border-brand bg-brand-tint" : "border-slate-200 bg-white"}`}><b className="text-sm">{s(pl, "name")}</b><span className="mt-1 block text-lg font-extrabold">₹{String(pl.price)}{n(pl, "mrp") > 0 ? <span className="ml-1 text-sm font-normal text-slate-400 line-through">₹{String(pl.mrp)}</span> : ""}</span>{disc > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">{disc}% OFF</span>}<span className="mt-1 block text-xs text-slate-500">{planValidity(pl)}{s(pl, "features") ? ` · ${s(pl, "features")}` : ""}</span></button>; })}</div> : <p className="text-xs text-slate-500">No plans yet for this batch — batch price applies.</p>}
                  <button onClick={() => payAndEnrol(bid, selId || undefined)} disabled={payBusy === bid} className="btn-brand mt-2 !py-2 text-xs">{payBusy === bid ? "Starting payment…" : (sel ? n(sel, "price") > 0 : n(b, "price") > 0) ? `Enroll — Pay ₹${sel ? String(sel.price) : String(b.price)} via Cashfree` : "Enroll free"}</button>
                </div>;
              })()}
              {profile?.role === "admin" && <button onClick={() => startEditBatch(b)} className="mt-2 rounded-lg border px-3 py-1 text-xs font-bold">Edit batch</button>}
              {isStaff && <button onClick={() => setShowEnrolled(showEnrolled === s(b, "id") ? "" : s(b, "id"))} className="mt-2 ml-2 rounded-lg border px-3 py-1 text-xs font-bold">{showEnrolled === s(b, "id") ? "Hide students" : "Show enrolled students"}</button>}
              {showEnrolled === s(b, "id") && <ul className="mt-2 space-y-1 text-sm">{enrolled.length === 0 ? <li className="text-slate-500">Nobody enrolled yet.</li> : enrolled.map(e => { const sb = subFor(s(e, "student_id"), s(b, "id")); return <li key={s(e, "id")} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{nameOf(s(e, "student_id"))}{sb ? <span className="text-xs text-slate-500"> · {s(sb, "plan_name") || "Enrolled"}{s(sb, "valid_until") ? ` · valid until ${s(sb, "valid_until")}` : ""}{s(sb, "status") === "expired" || (s(sb, "valid_until") && s(sb, "valid_until") < todayStr) ? " · Expired" : ""}</span> : null}</span>{isStaff && <button onClick={() => unenrol(s(b, "id"), s(e, "student_id"))} className="text-xs font-bold text-red-700">Remove</button>}</li>; })}</ul>}
            </div></div>;
          })}
        </div>
        {isStaff && <div className="card mt-3"><h3 className="font-extrabold">Payments — Cashfree orders</h3>
          <p className="mt-1 text-sm text-slate-600">Who paid, for which batch, and whether Cashfree confirmed it. Only “paid” orders enrol the student automatically. If a student paid in cash/UPI at the institute instead, enrol them with the “Enrol a student” panel above and record the fee in Fees &amp; Receipts.</p>
          <div className="mt-3 space-y-2">
            {(data.payments || []).length === 0 && <p className="text-sm text-slate-500">No payments yet. Paid batches show here once a student pays via Cashfree.</p>}
            {(data.payments || []).map(p => <div key={s(p, "id")} className="rounded-xl border p-3 text-sm"><b>{nameOf(s(p, "student_id"))}</b> — {s(p, "batch_id") ? batchName(s(p, "batch_id")) : (data.courses || []).find(c => s(c, "id") === s(p, "course_id")) ? s((data.courses || []).find(c => s(c, "id") === s(p, "course_id")), "title") : "—"} · ₹{String(p.amount)} · Order {s(p, "order_id")}{s(p, "cf_payment_id") ? ` · Cashfree payment ${s(p, "cf_payment_id")}` : ""} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${s(p, "status") === "paid" ? "bg-brand-tint text-brand-dark" : s(p, "status") === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{s(p, "status")}</span></div>)}
          </div>
        </div>}
      </div>
    );
    if (section === "lectures") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Add lecture</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Lecture title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Chapter</label><input className="input" value={form.chapter || ""} onChange={e => setForm({ ...form, chapter: e.target.value })} /></div>
          <div><label className="label">YouTube URL</label><input className="input" value={form.youtube_url || ""} onChange={e => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></div>
          <div><label className="label">Notes</label><input className="input" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save lecture</button></form>}
        {!isStaff && activeBatchIds.size === 0 && <p className="card mt-3 text-sm text-slate-600">Enrol in a batch to access its lectures — pick a plan in Batches and pay via Cashfree.</p>}
        {learnBatch && <p className="card mt-3 text-sm">Showing lectures for <b>{batchName(learnBatch)}</b> <button onClick={() => setLearnBatch("")} className="ml-1 font-bold text-brand-dark underline">Show all my lectures ✕</button></p>}
        <div className="mt-4 space-y-2">
          {(data.lectures || []).filter(l => canSeeBatch(s(l, "batch_id")) && (!learnBatch || s(l, "batch_id") === learnBatch)).length === 0 && empty("No lectures yet.")}
          {(data.lectures || []).filter(l => canSeeBatch(s(l, "batch_id")) && (!learnBatch || s(l, "batch_id") === learnBatch)).map(l => { const id = ytId(s(l, "youtube_url")); return <div key={s(l, "id")} className="card !p-4"><b className="text-sm">{s(l, "title")}</b><p className="text-xs text-slate-500">{batchName(s(l, "batch_id"))} · {s(l, "subject")} · {s(l, "chapter")}</p>
            {id ? <div className="mt-2 aspect-video w-full max-w-xl overflow-hidden rounded-xl"><iframe className="h-full w-full" src={`https://www.youtube.com/embed/${id}`} title={s(l, "title")} allowFullScreen /></div> : s(l, "youtube_url") ? <a className="mt-2 inline-block text-sm font-bold text-brand-dark underline" href={s(l, "youtube_url")} target="_blank" rel="noreferrer">▶ Watch on YouTube</a> : null}
            {s(l, "notes") && <p className="mt-2 text-sm text-slate-600">{s(l, "notes")}</p>}</div>; })}
        </div>
      </div>
    );
    if (section === "materials") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Add study material</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          {sel("Kind", form.kind || "", v => setForm({ ...form, kind: v }), [{ v: "Notes", l: "Notes" }, { v: "PYQ", l: "PYQ" }, { v: "Worksheet", l: "Worksheet" }, { v: "E-book", l: "E-book" }])}
          <div><label className="label">File / link URL</label><input className="input" value={form.file_url || ""} onChange={e => setForm({ ...form, file_url: e.target.value })} placeholder="https://… (PDF / Drive link)" /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><input className="input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save material</button></form>}
        {!isStaff && activeBatchIds.size === 0 && <p className="card mt-3 text-sm text-slate-600">Enrol in a batch to access its study materials — pick a plan in Batches and pay via Cashfree.</p>}
        <div className="mt-4 space-y-2">
          {(data.materials || []).filter(m => canSeeBatch(s(m, "batch_id"))).length === 0 && empty("No materials yet.")}
          {(data.materials || []).filter(m => canSeeBatch(s(m, "batch_id"))).map(m => <div key={s(m, "id")} className="card !p-4"><b className="text-sm">{s(m, "title")}</b><p className="text-xs text-slate-500">{batchName(s(m, "batch_id"))} · {s(m, "kind")}</p>{s(m, "description") && <p className="mt-1 text-sm text-slate-600">{s(m, "description")}</p>}{s(m, "file_url") && <a className="mt-2 inline-block text-sm font-bold text-brand-dark underline" href={s(m, "file_url")} target="_blank" rel="noreferrer">Open file ↗</a>}</div>)}
        </div>
      </div>
    );
    if (section === "assignments") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Create assignment</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Due date</label><input type="date" className="input" value={form.due_date || ""} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><input className="input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save assignment</button></form>}
        <div className="mt-4 space-y-2">
          {(data.assignments || []).filter(a => canSeeBatch(s(a, "batch_id"))).length === 0 && empty("No assignments yet.")}
          {(data.assignments || []).filter(a => canSeeBatch(s(a, "batch_id"))).map(a => {
            const aid = s(a, "id");
            const subs = (data.submissions || []).filter(x => s(x, "assignment_id") === aid && (profile?.role !== "teacher" || teacherStudentIds.has(s(x, "student_id"))));
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
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Test title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Total marks</label><input type="number" className="input" value={form.total_marks || ""} onChange={e => setForm({ ...form, total_marks: e.target.value })} /></div>
          <div><label className="label">Test date</label><input type="date" className="input" value={form.test_date || ""} onChange={e => setForm({ ...form, test_date: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save test</button></form>}
        <div className="mt-4 space-y-2">
          {(data.tests || []).filter(t => canSeeBatch(s(t, "batch_id"))).length === 0 && empty("No tests yet.")}
          {(data.tests || []).filter(t => canSeeBatch(s(t, "batch_id"))).map(t => {
            const tid = s(t, "id");
            const results = (data.test_results || []).filter(r => s(r, "test_id") === tid);
            const avg = results.length ? (results.reduce((a, r) => a + n(r, "marks"), 0) / results.length).toFixed(1) : "—";
            const mine = results.find(r => s(r, "student_id") === effectiveId);
            const visible = isStaff ? results : mine ? [mine] : [];
            return <div key={tid} className="card !p-4"><b className="text-sm">{s(t, "title")}</b><p className="text-xs text-slate-500">{batchName(s(t, "batch_id"))} · {s(t, "subject")} · Total {String(t.total_marks ?? "")} · {s(t, "test_date")} · Class average: {avg}</p>
              {isStaff && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">Enter marks per student</p><div className="mt-2 grid gap-2 sm:grid-cols-4">
                {sel("Student", testStu[tid] || "", v => setTestStu({ ...testStu, [tid]: v }), (profile?.role === "teacher" ? students.filter(x => teacherStudentIds.has(s(x, "id"))) : students).map(x => ({ v: s(x, "id"), l: s(x, "full_name") })))}
                <div><label className="label">Marks</label><input type="number" className="input" value={testMarks[tid] || ""} onChange={e => setTestMarks({ ...testMarks, [tid]: e.target.value })} /></div>
                <div><label className="label">Remarks</label><input className="input" value={testRem[tid] || ""} onChange={e => setTestRem({ ...testRem, [tid]: e.target.value })} /></div>
                <div className="flex items-end"><button onClick={() => enterMarks(tid)} className="btn-brand !py-2.5 text-xs">Save marks</button></div></div></div>}
              <ul className="mt-2 space-y-1 text-sm">{visible.length === 0 ? <li className="text-slate-500">{isStaff ? "No results entered yet." : "Your result is not entered yet."}</li> : visible.map(r => <li key={s(r, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span>{nameOf(s(r, "student_id"))} — <b>{String(r.marks ?? "—")} / {String(t.total_marks ?? "")}</b>{s(r, "remarks") ? ` · ${s(r, "remarks")}` : ""}</span>{Number(r.marks || 0) / Number(t.total_marks || 1) * 100 >= 40 && <button onClick={() => setCert({ student: nameOf(s(r, "student_id")), test: s(t, "title"), marks: Number(r.marks || 0), total: Number(t.total_marks || 0), date: s(t, "test_date") })} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold">🏆 Certificate</button>}</li>)}</ul>
            </div>;
          })}
        </div>
      </div>
    );
    if (section === "live_classes") return (
      <div>
        {isStaff && <form onSubmit={createRow} className="card mt-3"><h3 className="font-extrabold">Schedule live class</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Batch", form.batch_id || "", v => setForm({ ...form, batch_id: v }), (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Meet / Zoom link</label><input className="input" value={form.meet_url || ""} onChange={e => setForm({ ...form, meet_url: e.target.value })} placeholder="https://meet.google.com/…" /></div>
          <div><label className="label">Starts at</label><input type="datetime-local" className="input" value={form.starts_at || ""} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
          {sel("Status", form.status || "scheduled", v => setForm({ ...form, status: v }), [{ v: "scheduled", l: "Scheduled" }, { v: "live", l: "Live now" }])}
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save live class</button></form>}
        <div className="card mt-3"><h3 className="font-extrabold">Weekly timetable</h3>
          {isStaff && <form onSubmit={createTimetable} className="mt-3 grid gap-3 sm:grid-cols-3">
            {sel("Batch", ttForm.batch_id, v => setTtForm({ ...ttForm, batch_id: v }), (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
            {sel("Day", ttForm.day_of_week, v => setTtForm({ ...ttForm, day_of_week: v }), DAYS.map(d => ({ v: d, l: d })))}
            <div><label className="label">Subject</label><input className="input" value={ttForm.subject} onChange={e => setTtForm({ ...ttForm, subject: e.target.value })} /></div>
            <div><label className="label">Start time</label><input type="time" className="input" value={ttForm.start_time} onChange={e => setTtForm({ ...ttForm, start_time: e.target.value })} /></div>
            <div><label className="label">End time</label><input type="time" className="input" value={ttForm.end_time} onChange={e => setTtForm({ ...ttForm, end_time: e.target.value })} /></div>
            {sel("Teacher", ttForm.teacher_id, v => setTtForm({ ...ttForm, teacher_id: v }), teachers.map(x => ({ v: s(x, "id"), l: s(x, "full_name") })))}
            <div className="flex items-end"><button className="btn-brand !py-2.5 text-sm">Add to timetable</button></div>
          </form>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DAYS.map(d => { const rows = (data.timetable || []).filter(x => s(x, "day_of_week") === d && canSeeBatch(s(x, "batch_id"))).sort((a, b) => s(a, "start_time").localeCompare(s(b, "start_time"))); return <div key={d} className="rounded-xl border p-3"><b className="text-sm">{d}</b>{rows.length === 0 ? <p className="mt-1 text-xs text-slate-500">No classes.</p> : <ul className="mt-1 space-y-1 text-xs">{rows.map(x => <li key={s(x, "id")} className="rounded-lg bg-slate-50 px-2 py-1.5"><b>{s(x, "start_time")}–{s(x, "end_time")}</b> · {s(x, "subject")} · {batchName(s(x, "batch_id"))}{s(x, "teacher_id") ? ` · ${nameOf(s(x, "teacher_id"))}` : ""}</li>)}</ul>}</div>; })}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {(data.live_classes || []).filter(c => canSeeBatch(s(c, "batch_id"))).length === 0 && empty("No live classes scheduled yet.")}
          {(data.live_classes || []).filter(c => canSeeBatch(s(c, "batch_id"))).map(c => <div key={s(c, "id")} className="card !p-4"><b className="text-sm">{s(c, "title")}</b><p className="text-xs text-slate-500">{batchName(s(c, "batch_id"))} · {s(c, "subject")} · {s(c, "starts_at") ? new Date(s(c, "starts_at")).toLocaleString() : "—"}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${s(c, "status") === "live" ? "bg-red-100 text-red-700" : "bg-brand-tint text-brand-dark"}`}>{s(c, "status") === "live" ? "● Live now" : "Scheduled"}</span>{s(c, "meet_url") && <div><a href={s(c, "meet_url")} target="_blank" rel="noreferrer" className="btn-brand mt-2 inline-block !py-2 text-xs">Join class ↗</a></div>}</div>)}
        </div>
      </div>
    );
    if (section === "attendance") return (
      <div>
        {isStaff ? <div className="card mt-3"><h3 className="font-extrabold">Mark attendance — full roster</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
          {sel("Batch", attBatch, setAttBatch, (profile?.role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches).map(b => ({ v: s(b, "id"), l: s(b, "name") })))}
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
          {sel("Payment mode", feeMode, setFeeMode, [{ v: "Cash", l: "Cash" }, { v: "UPI", l: "UPI" }, { v: "Bank Transfer", l: "Bank Transfer" }])}
          <div><label className="label">UPI reference / transaction ID (if UPI)</label><input className="input" value={feeUpiRef} onChange={e => setFeeUpiRef(e.target.value)} placeholder="e.g. 123456789012" /></div>
          <div><label className="label">Coupon code (optional — % off applied)</label><input className="input" value={feeCoupon} onChange={e => setFeeCoupon(e.target.value)} placeholder="e.g. UPLUS10" /></div>
          <div><label className="label">Institute UPI ID (shown on receipts)</label><input className="input" value={feeUpiId} onChange={e => setFeeUpiId(e.target.value)} placeholder="e.g. uacademy@okhdfcbank" /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Save fee — receipt auto-generated (U++-2026-XXXX)</button><p className="mt-2 text-xs text-slate-500">UPI payments are recorded here only — there is no online payment gateway connected. Collect the payment on the institute UPI ID above and keep the UPI reference.</p></form>}
        {(() => { const list = (data.fees || []).filter(f => viewStudent(f)); const collected = list.filter(f => s(f, "status") === "paid").reduce((t, f) => t + n(f, "amount"), 0); const pending = list.filter(f => s(f, "status") === "pending").reduce((t, f) => t + n(f, "amount"), 0); return <div><div className="mt-3 grid grid-cols-2 gap-3"><div className="card !p-4"><b className="text-xl">₹{collected}</b><span className="block text-xs font-bold text-slate-500">Collected</span></div><div className="card !p-4"><b className="text-xl">₹{pending}</b><span className="block text-xs font-bold text-slate-500">Pending</span></div></div>
        {profile?.role !== "admin" && <div className="card mt-3"><h3 className="font-extrabold">My Payments — Cashfree</h3>
          <p className="mt-1 text-sm text-slate-600">Every online payment you made, with its verified status from the database. “Paid” means Cashfree confirmed it and your enrolment was created.</p>
          <div className="mt-3 space-y-2">
            {(data.payments || []).length === 0 && <p className="text-sm text-slate-500">No online payments yet — buy a batch plan in My Batches to see it here.</p>}
            {(data.payments || []).map(p => <div key={s(p, "id")} className="rounded-xl border p-3 text-sm"><b>₹{String(p.amount)}</b> — {batchName(s(p, "batch_id"))} · Order {s(p, "order_id")}{s(p, "cf_payment_id") ? ` · Cashfree payment ${s(p, "cf_payment_id")}` : ""} · {s(p, "created_at") ? new Date(s(p, "created_at")).toLocaleDateString() : ""} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${s(p, "status") === "paid" || s(p, "status") === "successful" ? "bg-brand-tint text-brand-dark" : s(p, "status") === "failed" ? "bg-red-100 text-red-700" : s(p, "status") === "refunded" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800"}`}>{s(p, "status") === "paid" || s(p, "status") === "successful" ? "Successful" : s(p, "status") === "created" || s(p, "status") === "pending" ? "Pending" : s(p, "status")}</span> <a href={`/payment/result?order_id=${encodeURIComponent(s(p, "order_id"))}`} className="ml-2 font-bold text-brand-dark underline">Details →</a></div>)}
          </div>
        </div>}
        <div className="mt-4 space-y-2">{list.length === 0 && empty("No fees recorded yet.")}{list.map(f => <div key={s(f, "id")} className="card !p-4"><b className="text-sm">₹{String(f.amount)} — {nameOf(s(f, "student_id"))}</b><p className="text-xs text-slate-500">Receipt {s(f, "receipt_no") || "—"} · {batchName(s(f, "batch_id"))} · Due {s(f, "due_month")} · {s(f, "paid_at") ? `Paid ${new Date(s(f, "paid_at")).toLocaleDateString()}` : "Not paid"}{s(f, "payment_mode") ? ` · ${s(f, "payment_mode")}` : ""}{s(f, "upi_reference") ? ` · UPI ref: ${s(f, "upi_reference")}` : ""}{s(f, "coupon_code") ? ` · Coupon: ${s(f, "coupon_code")}` : ""}{feeUpiId ? ` · Pay UPI: ${feeUpiId}` : ""}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${s(f, "status") === "paid" ? "bg-brand-tint text-brand-dark" : "bg-amber-100 text-amber-800"}`}>{s(f, "status")}</span>{profile?.role === "admin" && s(f, "status") === "pending" && <button onClick={() => markPaid(s(f, "id"))} className="btn-brand ml-2 !py-1.5 text-xs">Mark as paid</button>}</div>)}</div></div>; })()}
      </div>
    );
    if (section === "doubts") return (
      <div>
        <div className="card mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-extrabold">Doubt Discussion Forum</h3><p className="mt-1 text-sm text-slate-600">Ask a question — classmates and teachers in your batches can answer it. You get a notification when someone answers your doubt.</p></div>
            <button onClick={() => setShowAsk(!showAsk)} className="btn-brand !py-2.5 text-sm">{showAsk ? "Close form" : "＋ Ask a Doubt"}</button>
          </div>
          {showAsk && <form onSubmit={askForumQuestion} className="mt-4 grid gap-3 border-t pt-4">
            <div><label className="label">Batch *</label><select required className="input" value={forumForm.batch_id} onChange={e => setForumForm({ ...forumForm, batch_id: e.target.value })}><option value="">— pick your batch —</option>{batches.filter(b => profile?.role !== "student" || activeBatchIds.has(s(b, "id"))).map(b => <option key={s(b, "id")} value={s(b, "id")}>{s(b, "name")}</option>)}</select></div>
            <div><label className="label">Subject</label><input className="input" value={forumForm.subject} onChange={e => setForumForm({ ...forumForm, subject: e.target.value })} placeholder="e.g. Mathematics — Algebra" /></div>
            <div><label className="label">Question title *</label><input required className="input" value={forumForm.title} onChange={e => setForumForm({ ...forumForm, title: e.target.value })} placeholder="e.g. How do I solve quadratic equations by factorisation?" /></div>
            <div><label className="label">Detailed description *</label><textarea required className="input" rows={4} value={forumForm.body} onChange={e => setForumForm({ ...forumForm, body: e.target.value })} placeholder="Explain what you tried, where you got stuck, and what you need help with…" /></div>
            <div><label className="label">Screenshot / image URL (optional — no in-app upload yet, paste a public link)</label><input className="input" value={forumForm.image_url} onChange={e => setForumForm({ ...forumForm, image_url: e.target.value })} placeholder="https://… (image link)" /></div>
            <div><button className="btn-brand !py-2.5 text-sm">Post my doubt</button></div>
          </form>}
        </div>
        <div className="card mt-3">
          <div className="flex flex-wrap gap-2">
            <input className="input !w-auto flex-1" placeholder="Search questions…" value={forumSearch} onChange={e => setForumSearch(e.target.value)} />
            {sel("Subject", forumSubject, setForumSubject, Array.from(new Set((data.doubt_questions || []).map(q => s(q, "subject")).filter(Boolean))).map(x => ({ v: x, l: x })), "All subjects")}
            {sel("Batch", forumBatch, setForumBatch, batches.map(b => ({ v: s(b, "id"), l: s(b, "name") })), "All batches")}
            {sel("Status", forumStatus, setForumStatus, [{ v: "open", l: "Open" }, { v: "answered", l: "Answered" }, { v: "resolved", l: "Resolved" }], "All statuses")}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["recent","unanswered","mine","helpful"] as const).map(t => <button key={t} onClick={() => setForumTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${forumTab === t ? "bg-brand text-white" : "bg-slate-200"}`}>{t === "recent" ? "Recent Questions" : t === "unanswered" ? "Unanswered" : t === "mine" ? "My Questions" : "Most Helpful"}</button>)}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {(() => {
            let qs = [...(data.doubt_questions || [])];
            if (forumTab === "unanswered") qs = qs.filter(q => s(q, "status") === "open");
            if (forumTab === "mine") qs = qs.filter(q => s(q, "student_id") === effectiveId);
            if (forumTab === "helpful") qs = qs.sort((a, b) => forumAnswers(s(b, "id")).reduce((t, x) => t + forumVotes(s(x, "id")), 0) - forumAnswers(s(a, "id")).reduce((t, x) => t + forumVotes(s(x, "id")), 0));
            if (forumSearch) qs = qs.filter(q => (s(q, "title") + " " + s(q, "body")).toLowerCase().includes(forumSearch.toLowerCase()));
            if (forumSubject) qs = qs.filter(q => s(q, "subject") === forumSubject);
            if (forumBatch) qs = qs.filter(q => s(q, "batch_id") === forumBatch);
            if (forumStatus) qs = qs.filter(q => s(q, "status") === forumStatus);
            if (qs.length === 0) return <div className="card text-sm text-slate-500">{(data.doubt_questions || []).length === 0 ? "No doubts yet — be the first to ask one above." : "No questions match these filters."}</div>;
            return qs.map(q => {
              const qid = s(q, "id");
              const answers = forumAnswers(qid);
              const upvotes = answers.reduce((t, a) => t + forumVotes(s(a, "id")), 0);
              const accepted = answers.find(a => String(a.is_accepted) === "true");
              const open = openQ === qid;
              return <div key={qid} className="card !p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">{s(q, "title")}</b>
                    <p className="text-xs text-slate-500">{s(q, "student_name") || nameOf(s(q, "student_id"))} · {s(q, "subject") || "General"} · {batchName(s(q, "batch_id"))} · {s(q, "created_at") ? new Date(s(q, "created_at")).toLocaleDateString() : "—"}</p>
                    <p className="mt-1 text-sm text-slate-600">{s(q, "body")}</p>
                    {s(q, "image_url") && <a className="mt-1 inline-block text-sm font-bold text-brand-dark underline" href={s(q, "image_url")} target="_blank" rel="noreferrer">View screenshot ↗</a>}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-extrabold ${s(q, "status") === "resolved" ? "bg-brand-tint text-brand-dark" : s(q, "status") === "answered" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>{s(q, "status") === "resolved" ? "✓ Resolved" : s(q, "status") === "answered" ? "Answered" : "Open"}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                  <span>💬 {answers.length} answer{answers.length === 1 ? "" : "s"}</span>
                  <span>▲ {upvotes} upvote{upvotes === 1 ? "" : "s"}</span>
                  {accepted && <span className="text-brand-dark">✓ Accepted answer: {s(accepted, "author_name")}</span>}
                  <button onClick={() => setOpenQ(open ? "" : qid)} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">{open ? "Hide discussion" : "View / answer"}</button>
                </div>
                {open && <div className="mt-3 space-y-3 border-t pt-3">
                  {answers.length === 0 && <p className="text-sm text-slate-500">No answers yet — be the first to help.</p>}
                  {answers.filter(a => !s(a, "parent_answer_id")).map(a => {
                    const aid = s(a, "id");
                    const replies = answers.filter(r => s(r, "parent_answer_id") === aid);
                    const voted = (data.doubt_votes || []).some(v => s(v, "answer_id") === aid && s(v, "user_id") === profile?.id);
                    return <div key={aid} className={`rounded-xl border p-3 ${String(a.is_accepted) === "true" ? "border-brand bg-brand-tint/40" : ""}`}>
                      <p className="text-xs text-slate-500"><b className="text-slate-800">{s(a, "author_name")}</b> · <span className="capitalize">{s(a, "author_role")}</span> · {s(a, "created_at") ? new Date(s(a, "created_at")).toLocaleString() : ""}{String(a.is_accepted) === "true" && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white">✓ Accepted answer</span>}</p>
                      <p className="mt-1 text-sm">{s(a, "body")}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button onClick={() => toggleVote(aid)} className={`rounded-full px-3 py-1 text-xs font-extrabold ${voted ? "bg-brand text-white" : "bg-slate-200"}`}>▲ {forumVotes(aid)} {voted ? "Upvoted" : "Upvote"}</button>
                        {String(a.is_accepted) !== "true" && (s(q, "student_id") === effectiveId || profile?.role === "teacher" || profile?.role === "admin") && <button onClick={() => acceptAnswer(qid, aid)} className="rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold">Mark as accepted</button>}
                        <button onClick={() => setReplyTo({ ...replyTo, [aid]: replyTo[aid] ? "" : "open" })} className="rounded-full border px-3 py-1 text-xs font-bold">Reply</button>
                      </div>
                      {replies.map(r => <div key={s(r, "id")} className="ml-4 mt-2 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500"><b className="text-slate-800">{s(r, "author_name")}</b> · <span className="capitalize">{s(r, "author_role")}</span></p><p className="mt-1 text-sm">{s(r, "body")}</p></div>)}
                      {replyTo[aid] === "open" && <div className="ml-4 mt-2"><textarea className="input" rows={2} placeholder="Reply to this answer…" value={ansText[`${qid}:${aid}`] || ""} onChange={e => setAnsText({ ...ansText, [`${qid}:${aid}`]: e.target.value })} /><button onClick={() => postForumAnswer(qid, aid)} className="btn-brand mt-2 !py-2 text-xs">Post reply</button></div>}
                    </div>;
                  })}
                  <div><label className="label">Your answer</label><textarea className="input" rows={3} placeholder="Write a clear, helpful answer…" value={ansText[qid] || ""} onChange={e => setAnsText({ ...ansText, [qid]: e.target.value })} /><button onClick={() => postForumAnswer(qid)} className="btn-brand mt-2 !py-2 text-xs">Post answer</button></div>
                </div>}
              </div>;
            });
          })()}
        </div>
      </div>
    );
    if (section === "notifications") return (
      <div>
        {isStaff && <form onSubmit={createAnnouncement} className="card mt-3"><h3 className="font-extrabold">Send announcement</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          {sel("Audience", annAud, setAnnAud, [{ v: "all", l: "Everyone" }, { v: "students", l: "Students" }, { v: "parents", l: "Parents" }, { v: "teachers", l: "Teachers" }])}
          <div className="sm:col-span-2"><label className="label">Message</label><input required className="input" value={form.body || ""} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
        </div><button className="btn-brand mt-3 !py-2.5 text-sm">Send announcement</button><p className="mt-2 text-xs text-slate-500">This also creates a notification for each person in the audience. Push notifications to phones are not built — there is no push service on the free tier — so announcements appear as in-app notifications here.</p></form>}
        <h3 className="mt-5 font-extrabold">Announcements</h3>
        <div className="mt-2 space-y-2">{(data.announcements || []).length === 0 && empty("No announcements yet.")}{(data.announcements || []).map(a => <div key={s(a, "id")} className="card !p-4"><b className="text-sm">{s(a, "title")}</b><p className="text-sm text-slate-600">{s(a, "body")}</p><p className="text-xs text-slate-500">Audience: {s(a, "audience")}</p></div>)}</div>
        <h3 className="mt-5 font-extrabold">Your notifications</h3>
        <div className="mt-2 space-y-2">{(data.notifications || []).filter(nt => viewUser(nt)).length === 0 && empty("No notifications for you yet.")}{(data.notifications || []).filter(nt => viewUser(nt)).map(nt => <div key={s(nt, "id")} className="card !p-4"><b className="text-sm">{s(nt, "title")}</b><p className="text-sm text-slate-600">{s(nt, "body")}</p>{!nt.is_read ? <button onClick={() => markRead(s(nt, "id"))} className="mt-2 rounded-lg border px-3 py-1 text-xs font-bold">Mark as read</button> : <span className="mt-2 inline-block text-xs font-bold text-brand-dark">✓ Read</span>}</div>)}</div>
      </div>
    );
    if (section === "users") return (
      <div className="mt-4 space-y-2">
        <p className="card mt-3 text-sm text-slate-600">Admin only. New accounts are created by the user registering (there is no admin password reset from this panel — use Forgot password on the login page). Here you can change roles, block/unblock, link a parent to a child, and see each user&rsquo;s batch enrolments.</p>
        {/* ---- Teacher onboarding: approve requests ---- */}
        <div className="card mt-3"><h3 className="font-extrabold">Teacher requests — approve / reject</h3>
          <p className="mt-1 text-sm text-slate-600">Teachers apply from the landing page (“Join as a Teacher”). Approve them here; they can then register with the same email and their Teacher role is confirmed.</p>
          <div className="mt-3 space-y-2">
            {(data.teacher_requests || []).length === 0 && <p className="text-sm text-slate-500">No teacher requests yet.</p>}
            {(data.teacher_requests || []).map(r => <div key={s(r, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span><b>{s(r, "full_name")}</b> — {s(r, "email")} · {s(r, "mobile")} · {s(r, "subject")} · {s(r, "experience_years") ?? "—"} yrs · {s(r, "qualification") || "—"}</span><span className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${s(r, "status") === "approved" ? "bg-brand-tint text-brand-dark" : s(r, "status") === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{s(r, "status")}</span>{s(r, "status") === "pending" && <><button onClick={() => reviewRequest(s(r, "id"), "approved")} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-extrabold text-white">Approve</button><button onClick={() => reviewRequest(s(r, "id"), "rejected")} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-red-700">Reject</button></>}</span></div>)}
          </div>
        </div>
        {/* ---- Admin direct onboarding: invite a teacher / student ---- */}
        <form onSubmit={createInvite} className="card mt-3"><h3 className="font-extrabold">Onboard teacher / student</h3>
          <p className="mt-1 text-sm text-slate-600">Invite created. Ask the teacher/student to <b>Register on the live site with this exact email</b> — their account will be linked to this invite and they will be onboarded with the role you chose. <b>Admin cannot set their password — they choose it at registration.</b></p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="label">Full name</label><input required className="input" value={inviteForm.full_name} onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })} /></div>
            <div><label className="label">Email</label><input required type="email" className="input" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} /></div>
            <div><label className="label">Mobile number</label><input className="input" value={inviteForm.mobile} onChange={e => setInviteForm({ ...inviteForm, mobile: e.target.value })} /></div>
            {sel("Role to onboard", inviteForm.role, v => setInviteForm({ ...inviteForm, role: v }), [{ v: "teacher", l: "Teacher" }, { v: "student", l: "Student" }])}
            {inviteForm.role === "teacher" && <>{sel("Subject", inviteForm.subject, v => setInviteForm({ ...inviteForm, subject: v }), ["Mathematics","Science","Physics","Chemistry","Biology","English","Social Science","Accounts","Economics"].map(c => ({ v: c, l: c })))}</>}
            {inviteForm.role === "student" && <>{sel("Class", inviteForm.class_label, v => setInviteForm({ ...inviteForm, class_label: v }), ["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"].map(c => ({ v: c, l: c })))}{sel("Board", inviteForm.board, v => setInviteForm({ ...inviteForm, board: v }), ["CBSE","ICSE","State Board","Other"].map(c => ({ v: c, l: c })))}</>}
          </div>
          <button className="btn-brand mt-3 !py-2.5 text-sm">Create invite</button>
        </form>
        <div className="card mt-3"><h3 className="font-extrabold">Invites sent</h3>
          <div className="mt-2 space-y-2">
            {(data.onboarding_invites || []).length === 0 && <p className="text-sm text-slate-500">No invites yet.</p>}
            {(data.onboarding_invites || []).map(inv => <div key={s(inv, "id")} className="rounded-xl border p-3 text-sm"><b>{s(inv, "full_name")}</b> — {s(inv, "email")} · <span className="capitalize">{s(inv, "role")}</span>{s(inv, "subject") ? ` · ${s(inv, "subject")}` : ""}{s(inv, "class_label") ? ` · ${s(inv, "class_label")} ${s(inv, "board")}` : ""} · <span className={`rounded-full px-2 py-1 text-xs font-bold ${s(inv, "status") === "registered" ? "bg-brand-tint text-brand-dark" : "bg-amber-100 text-amber-800"}`}>{s(inv, "status")}</span></div>)}
          </div>
        </div>
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
        <div className="card mt-3"><h3 className="font-extrabold">Leads CRM — enquiries from the landing page</h3>
          <p className="mt-1 text-sm text-slate-600">Track every demo enquiry as a lead: set its status and follow-up date, or convert it into an onboarding invite (enter the student's email first).</p>
          <div className="mt-2 space-y-2">
            {(data.enquiries || []).length === 0 && <p className="text-sm text-slate-500">No enquiries yet.</p>}
            {(data.enquiries || []).map(q => { const qid = s(q, "id"); return <div key={qid} className="rounded-xl border p-3 text-sm"><b>{s(q, "student_name")}</b> — {s(q, "parent_mobile")} · {s(q, "class_label")} · {s(q, "board")} · Interested in: {s(q, "interested_in")}{s(q, "notes") ? ` · ${s(q, "notes")}` : ""}
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                {sel("Status", leadStatus[qid] || s(q, "status") || "new", v => setLeadStatus({ ...leadStatus, [qid]: v }), [{ v: "new", l: "New" }, { v: "contacted", l: "Contacted" }, { v: "enrolled", l: "Enrolled" }, { v: "rejected", l: "Rejected" }])}
                <div><label className="label">Follow-up date</label><input type="date" className="input" value={leadFollow[qid] || s(q, "follow_up_date") || ""} onChange={e => setLeadFollow({ ...leadFollow, [qid]: e.target.value })} /></div>
                <div><label className="label">Student email (to convert)</label><input className="input" placeholder="student@email.com" value={leadEmail[qid] || ""} onChange={e => setLeadEmail({ ...leadEmail, [qid]: e.target.value })} /></div>
                <div className="flex items-end gap-2"><button onClick={() => updateLead(qid)} className="rounded-lg border px-3 py-2 text-xs font-bold">Save lead</button>{profile?.role === "admin" && <button onClick={() => convertLead(q)} className="btn-brand !py-2 text-xs">Convert to invite</button>}</div>
              </div>
            </div>; })}
          </div>
        </div>
        <div className="card mt-3"><h3 className="font-extrabold">Coupons — discounts for fees &amp; courses</h3>
          {profile?.role === "admin" && <form onSubmit={createCoupon} className="mt-3 grid gap-3 sm:grid-cols-4">
            <div><label className="label">Coupon code</label><input required className="input" value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value })} placeholder="e.g. UPLUS10" /></div>
            <div><label className="label">Discount % off</label><input required type="number" className="input" value={couponForm.discount_percent} onChange={e => setCouponForm({ ...couponForm, discount_percent: e.target.value })} placeholder="10" /></div>
            <div><label className="label">Valid until</label><input type="date" className="input" value={couponForm.valid_until} onChange={e => setCouponForm({ ...couponForm, valid_until: e.target.value })} /></div>
            <div className="flex items-end"><button className="btn-brand !py-2.5 text-sm">Create coupon</button></div>
          </form>}
          <div className="mt-3 space-y-2">
            {(data.coupons || []).length === 0 && <p className="text-sm text-slate-500">No coupons yet. Create one above (Admin) — then use its code in Fees or in a course enrolment.</p>}
            {(data.coupons || []).map(c => <div key={s(c, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span><b>{s(c, "code")}</b> — {String(c.discount_percent ?? 0)}% off{s(c, "valid_until") ? ` · valid until ${s(c, "valid_until")}` : ""}</span><span className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${String(c.is_active) === "false" ? "bg-slate-200" : "bg-brand-tint text-brand-dark"}`}>{String(c.is_active) === "false" ? "Inactive" : "Active"}</span>{profile?.role === "admin" && <button onClick={() => toggleCoupon(c)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">{String(c.is_active) === "false" ? "Activate" : "Deactivate"}</button>}</span></div>)}
          </div>
        </div>
        <div className="card mt-3"><h3 className="font-extrabold">Live counts</h3><ul className="mt-2 space-y-1 text-sm text-slate-600"><li>Batches: {counts.batches ?? 0}</li><li>Lectures: {counts.lectures ?? 0}</li><li>Assignments: {counts.assignments ?? 0}</li><li>Tests: {counts.tests ?? 0}</li><li>Fees recorded: {counts.fees ?? 0}</li><li>Open doubts: {counts.doubts ?? 0}</li></ul></div>
      </div>
    );
    return null;
  }
}
