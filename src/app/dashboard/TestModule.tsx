// Test & Assessment Module — dashboard section component.
// Teacher: create-test wizard (manual editor, question bank, CSV/JSON/XLSX
// bulk import), publish/schedule, results + analytics, manual marks entry.
// Student: Available / Upcoming / Live / Completed tests, instructions,
// distraction-free exam screen (palette, timer, autosave, resume, auto-
// submit), results. Descriptive (essay) questions are answered in free
// text, score 0 automatically, and are graded by hand by the teacher
// (POST /api/tests/grade) — the attempt total is provisional until graded. SECURITY: correct answers, scoring and deadlines are
// enforced by src/app/api/tests/* — the client never sees answer keys
// before release and never sends marks.
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Download, Eye,
  FileUp, Flag, ListChecks, Pencil, Play, Plus, Search, Timer, Trash2,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const s = (r: Row | null | undefined, k: string) => String((r as Row)?.[k] ?? "");
const n = (r: Row | null | undefined, k: string) => Number((r as Row)?.[k] ?? 0) || 0;

export type TestModuleProps = {
  supabase: SupabaseClient;
  profile: Row;
  data: Record<string, Row[]>;
  effectiveId: string;
  isStaff: boolean;
  canSeeBatch: (batchId: string) => boolean;
  myBatchIds: string[];
  teacherStudentIds: Set<string>;
  students: Row[];
  nameOf: (id: string) => string;
  batchName: (id: string) => string;
  loadAll: () => void;
  setMsg: (m: string) => void;
  // Old quick-create form (preserved verbatim from the dashboard).
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  createRow: (e: React.FormEvent) => void;
  setCert: (c: { student: string; test: string; marks: number; total: number; date: string } | null) => void;
};

type Opt = { label: string; text: string };
// Descriptive questions are answered in free text and graded by hand:
// they carry no options and no correct answers. Their model answer /
// grading guidance lives in `explanation` and is only shown to students
// after grading, when the test's "show explanations" setting allows it.
type QType = "single" | "multiple" | "descriptive";
const Q_TYPE_LABEL: Record<QType, string> = {
  single: "Single correct",
  multiple: "Multiple correct",
  descriptive: "Descriptive — manually graded",
};
type QDraft = {
  localId: string;
  question_text: string;
  question_type: QType;
  options: Opt[];
  correct: string[];
  explanation: string;
  marks: number;
  negative_marks: number;
  difficulty: string;
  subject: string;
  topic: string;
  bankId?: string;
  saveToBank?: boolean;
};

const CATEGORIES = ["Practice Test", "Chapter Test", "Weekly Test", "Mock Test", "Full-Length Test", "Previous Year Questions", "Assignment Test"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const LABELS = ["A", "B", "C", "D"];

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function emptyQ(subject = "", topic = ""): QDraft {
  return {
    localId: uid(), question_text: "", question_type: "single",
    options: LABELS.map(l => ({ label: l, text: "" })),
    correct: [], explanation: "", marks: 1, negative_marks: 0,
    difficulty: "Medium", subject, topic, saveToBank: true,
  };
}
function bankToDraft(b: Row): QDraft {
  const opts = (Array.isArray(b.options) ? b.options : []) as Row[];
  return {
    localId: uid(),
    question_text: s(b, "question_text"),
    question_type: (s(b, "question_type") || "single") as QType,
    options: LABELS.map(l => ({ label: l, text: s(opts.find(o => String(o.label) === l), "text") })),
    correct: (Array.isArray(b.correct_answers) ? b.correct_answers : []).map(String),
    explanation: s(b, "explanation"),
    marks: n(b, "marks") || 1,
    negative_marks: n(b, "negative_marks") || 0,
    difficulty: s(b, "difficulty") || "Medium",
    subject: s(b, "subject"), topic: s(b, "topic"),
    bankId: s(b, "id"), saveToBank: false,
  };
}
function draftToBankPayload(q: QDraft, teacherId: string, batchId: string | null) {
  const descriptive = q.question_type === "descriptive";
  return {
    teacher_id: teacherId, created_by: teacherId, batch_id: batchId,
    subject: q.subject || null, topic: q.topic || null,
    question_type: q.question_type, question_text: q.question_text,
    options: descriptive ? [] : q.options.filter(o => o.text.trim()),
    correct_answers: descriptive ? [] : q.correct,
    explanation: q.explanation || null,
    marks: q.marks, negative_marks: descriptive ? 0 : q.negative_marks,
    difficulty: q.difficulty, tags: [],
  };
}
function draftToTestQ(q: QDraft, testId: string, sortOrder: number) {
  const descriptive = q.question_type === "descriptive";
  return {
    test_id: testId, question_bank_id: q.bankId || null,
    question_text: q.question_text, question_type: q.question_type,
    options: descriptive ? [] : q.options.filter(o => o.text.trim()),
    correct_answers: descriptive ? [] : q.correct,
    explanation: q.explanation || null,
    marks: q.marks, negative_marks: descriptive ? 0 : q.negative_marks,
    difficulty: q.difficulty, subject: q.subject || null, topic: q.topic || null,
    sort_order: sortOrder,
  };
}
function validateDraft(q: QDraft): string | null {
  if (!q.question_text.trim()) return "Question text is empty.";
  if (q.question_type === "descriptive") {
    // No options, no correct answer — the student writes free text and the
    // teacher grades it against the model answer in `explanation`.
    if (!(q.marks >= 0)) return "Marks must be 0 or more.";
    return null;
  }
  const filled = q.options.filter(o => o.text.trim());
  if (filled.length < 2) return "Add at least two answer options.";
  if (!q.correct.length) return "Pick the correct answer.";
  if (q.correct.some(c => !filled.some(o => o.label === c))) return "Correct answer points to an empty option.";
  if (q.question_type === "single" && q.correct.length !== 1) return "Single-answer questions need exactly one correct option.";
  if (!(q.marks >= 0)) return "Marks must be 0 or more.";
  if (!(q.negative_marks >= 0)) return "Negative marks must be 0 or more.";
  return null;
}

// ---------- Bulk import parsing (CSV / JSON / XLSX) ----------
export type ImportRow = {
  question: string; question_type: string; option_a: string; option_b: string; option_c: string; option_d: string;
  correct_answer: string; explanation: string; marks: string; negative_marks: string;
  difficulty: string; subject: string; topic: string;
};
export type ParsedRow = { row: ImportRow; errors: string[]; draft: QDraft | null };

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some(c => c.trim() !== "")) out.push(cur);
      cur = [];
    } else field += ch;
  }
  if (field !== "" || cur.length) { cur.push(field); if (cur.some(c => c.trim() !== "")) out.push(cur); }
  return out;
}
const IMPORT_HEADERS = ["question", "question_type", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "marks", "negative_marks", "difficulty", "subject", "topic"];
function rowsToDrafts(rows: ImportRow[], existingTexts: Set<string>): ParsedRow[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const errors: string[] = [];
    const q = (r.question || "").trim();
    if (!q) errors.push("Missing question.");
    const typeRaw = (r.question_type || "single").trim().toLowerCase();
    const qType: QType = typeRaw === "multiple" ? "multiple" : typeRaw === "descriptive" ? "descriptive" : "single";
    if (typeRaw && !["single", "multiple", "descriptive"].includes(typeRaw)) errors.push("question_type must be single, multiple or descriptive.");
    const descriptive = qType === "descriptive";
    const opts = [r.option_a, r.option_b, r.option_c, r.option_d].map(v => (v || "").trim());
    const filled = opts.filter(Boolean);
    const ca = (r.correct_answer || "").trim().toUpperCase();
    if (descriptive) {
      // Descriptive rows need no options and no correct answer; the
      // explanation column holds the model answer / grading guidance.
      if (ca) errors.push("Descriptive questions must not have a correct_answer.");
    } else {
      if (filled.length < 2) errors.push("Need at least two options.");
      if (!["A", "B", "C", "D"].includes(ca)) errors.push("correct_answer must be A, B, C or D.");
      else if (!opts["ABCD".indexOf(ca)]) errors.push(`Correct answer ${ca} has no option text.`);
    }
    const marks = Number(r.marks === "" ? 1 : r.marks);
    if (!Number.isFinite(marks) || marks < 0) errors.push("Invalid marks.");
    const neg = Number(r.negative_marks === "" ? 0 : r.negative_marks);
    if (!Number.isFinite(neg) || neg < 0) errors.push("Invalid negative_marks.");
    const diff = (r.difficulty || "Medium").trim();
    if (!DIFFICULTIES.includes(diff)) errors.push("difficulty must be Easy, Medium or Hard.");
    if (q && existingTexts.has(q.toLowerCase())) errors.push("Duplicate of a question already in your bank.");
    if (q && seen.has(q.toLowerCase())) errors.push("Duplicate question inside this file.");
    if (q) seen.add(q.toLowerCase());
    const draft: QDraft | null = errors.length ? null : {
      localId: uid(), question_text: q, question_type: qType,
      options: LABELS.map((l, i) => ({ label: l, text: opts[i] || "" })),
      correct: descriptive ? [] : [ca], explanation: (r.explanation || "").trim(),
      marks, negative_marks: descriptive ? 0 : neg, difficulty: diff,
      subject: (r.subject || "").trim(), topic: (r.topic || "").trim(),
      saveToBank: true,
    };
    return { row: r, errors, draft };
  });
}
function parseImportText(text: string, fileName: string): { rows: ImportRow[]; error: string | null } {
  if (/\.json$/i.test(fileName)) {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(arr)) return { rows: [], error: "JSON must be an array of questions (or { questions: [...] })." };
      return { rows: arr.map((o: Row) => ({
        question: s(o, "question") || s(o, "question_text"),
        question_type: s(o, "question_type"),
        option_a: s(o, "option_a"), option_b: s(o, "option_b"), option_c: s(o, "option_c"), option_d: s(o, "option_d"),
        correct_answer: s(o, "correct_answer"),
        explanation: s(o, "explanation"), marks: s(o, "marks"), negative_marks: s(o, "negative_marks"),
        difficulty: s(o, "difficulty"), subject: s(o, "subject"), topic: s(o, "topic"),
      })), error: null };
    } catch { return { rows: [], error: "Could not parse JSON." }; }
  }
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], error: "Empty file." };
  const header = grid[0].map(h => h.trim().toLowerCase());
  // question_type is optional in the header (old templates lack it) and
  // defaults to "single" per row; every other column is required.
  const missing = IMPORT_HEADERS.filter(h => h !== "question_type" && !header.includes(h));
  if (missing.length) return { rows: [], error: `Missing columns: ${missing.join(", ")}.` };
  const rows = grid.slice(1).map(cells => {
    const r: ImportRow = { question: "", question_type: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "", marks: "", negative_marks: "", difficulty: "", subject: "", topic: "" };
    IMPORT_HEADERS.forEach(h => { (r as unknown as Record<string, string>)[h] = (cells[header.indexOf(h)] || "").trim(); });
    return r;
  }).filter(r => Object.values(r).some(v => v !== ""));
  return { rows, error: null };
}
const SAMPLE_CSV = [
  "question,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation,marks,negative_marks,difficulty,subject,topic",
  "What is the capital of India?,single,Mumbai,Delhi,Kolkata,Chennai,B,Delhi is the capital of India,1,0,Easy,Geography,Indian Geography",
  "Which language is used for data analysis?,single,HTML,Python,CSS,XML,B,Python is widely used for data analysis,2,0.5,Medium,Computer Science,Programming",
  "Explain why the seasons change on Earth.,descriptive,,,,,,The tilt of Earth's axis causes seasons as different hemispheres receive varying sunlight through the year.,5,0,Medium,Geography,Seasons",
].join("\n");
function downloadText(name: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmtClock(totalSec: number) {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function TestModule(props: TestModuleProps) {
  const { supabase, profile, data, effectiveId, isStaff, canSeeBatch, myBatchIds, teacherStudentIds, students, nameOf, batchName, loadAll, setMsg, form, setForm, createRow, setCert } = props;
  const role = s(profile, "role");
  const isStudent = role === "student" || role === "parent";
  const batches = data.batches || [];
  const tests = (data.tests || []).filter(t => canSeeBatch(s(t, "batch_id")));
  const staffBatches = role === "teacher" ? batches.filter(b => myBatchIds.includes(s(b, "id"))) : batches;

  const [tab, setTab] = useState("tests");
  const [bank, setBank] = useState<Row[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSubject, setBankSubject] = useState("");
  const [bankTopic, setBankTopic] = useState("");
  const [bankDifficulty, setBankDifficulty] = useState("");
  const [bankType, setBankType] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<string>>(new Set());
  const [testQCounts, setTestQCounts] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<Row[]>([]);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState("");
  const say = (m: string) => { setLocalMsg(m); setMsg(m); };

  // ---- Wizard state ----
  const [wizOpen, setWizOpen] = useState(false);
  const [wizStep, setWizStep] = useState(1);
  const [editingTestId, setEditingTestId] = useState("");
  const [wiz, setWiz] = useState({
    title: "", description: "", batch_id: "", subject: "", topic: "", category: "Practice Test",
    difficulty: "Medium", passing_marks: "", instructions: "", thumbnail_url: "",
    duration_minutes: "60", start_at: "", end_at: "", max_attempts: "1",
    randomize_questions: false, randomize_options: false, allow_revisit: true,
    show_results: "immediate", show_answers: true, show_explanations: true,
  });
  const [wizQs, setWizQs] = useState<QDraft[]>([]);
  const [qForm, setQForm] = useState<QDraft>(emptyQ());
  const [editingQ, setEditingQ] = useState("");
  const [qPreview, setQPreview] = useState(false);
  const [qTab, setQTab] = useState<"manual" | "bank" | "import">("manual");
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [showBankEditor, setShowBankEditor] = useState(false);
  const [bankEditing, setBankEditing] = useState("");
  const [quickCreate, setQuickCreate] = useState(false);
  // ---- Manual marks (preserved old flow) ----
  const [mmStu, setMmStu] = useState<Record<string, string>>({});
  const [mmMarks, setMmMarks] = useState<Record<string, string>>({});
  const [mmRem, setMmRem] = useState<Record<string, string>>({});
  // ---- Results ----
  const [resTestId, setResTestId] = useState("");
  const [resData, setResData] = useState<Row | null>(null);
  const [resBusy, setResBusy] = useState(false);
  // ---- Manual grading of descriptive answers (teacher) ----
  const [gradingAttemptId, setGradingAttemptId] = useState("");
  const [gradingData, setGradingData] = useState<Row | null>(null);
  const [gradeMarks, setGradeMarks] = useState<Record<string, string>>({});
  const [gradeBusy, setGradeBusy] = useState(false);
  // ---- Student exam ----
  const [instrTest, setInstrTest] = useState<Row | null>(null);
  const [exam, setExam] = useState<null | {
    test: Row; attemptId: string; expiresAt: string; attemptNo: number;
    questions: Row[]; answers: Record<string, string[]>; texts: Record<string, string>; marked: string[];
    visited: string[]; current: number; saving: boolean; confirmSubmit: boolean;
  }>(null);
  const [myResult, setMyResult] = useState<Row | null>(null);
  const [examBusy, setExamBusy] = useState(false);
  // Debounced autosave timers for descriptive text (one per question).
  const textSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Student list tab — declared up here with the other state, NOT after the
  // early returns below: a hook after a conditional return changes the hook
  // count between renders and React throws "Rendered fewer hooks".
  const [stuTab, setStuTab] = useState<"available" | "upcoming" | "completed" | "results">("available");
  const examRef = useRef(exam);
  examRef.current = exam;
  const submitGuard = useRef(false);

  // ---- Data loading for the module ----
  async function refreshModule() {
    const ids = tests.map(t => s(t, "id")).filter(Boolean);
    if (ids.length) {
      const { data: qs } = await supabase.from("test_questions").select("test_id").in("test_id", ids);
      const counts: Record<string, number> = {};
      for (const q of (qs as Row[]) || []) counts[s(q, "test_id")] = (counts[s(q, "test_id")] || 0) + 1;
      setTestQCounts(counts);
    } else setTestQCounts({});
    if (isStaff) {
      const { data: b } = await supabase.from("question_bank").select("*").order("created_at", { ascending: false }).limit(300);
      setBank((b as Row[]) || []);
      if (ids.length) {
        const { data: at } = await supabase.from("test_attempts").select("*").in("test_id", ids).order("submitted_at", { ascending: false }).limit(500);
        setAttempts((at as Row[]) || []);
        const c: Record<string, number> = {};
        for (const a of (at as Row[]) || []) c[s(a, "test_id")] = (c[s(a, "test_id")] || 0) + 1;
        setAttemptCounts(c);
      } else { setAttempts([]); setAttemptCounts({}); }
    } else {
      const { data: at } = await supabase.from("test_attempts").select("*").eq("student_id", effectiveId).order("started_at", { ascending: false }).limit(200);
      setAttempts((at as Row[]) || []);
      const c: Record<string, number> = {};
      for (const a of (at as Row[]) || []) c[s(a, "test_id")] = (c[s(a, "test_id")] || 0) + 1;
      setAttemptCounts(c);
    }
  }
  useEffect(() => { refreshModule(); }, [data.tests?.length, profile?.id]);

  const myTests = tests;
  const visibleStudentTests = tests.filter(t => {
    const st = s(t, "status") || "draft";
    return ["published", "scheduled", "active", "completed"].includes(st);
  });
  const attemptFor = (testId: string) => attempts.filter(a => s(a, "test_id") === testId);
  const latestAttempt = (testId: string) => {
    const list = attemptFor(testId);
    return list.sort((a, b) => s(b, "started_at").localeCompare(s(a, "started_at")))[0] || null;
  };
  const testStatus = (t: Row) => {
    const st = s(t, "status") || "draft";
    if (st !== "published" && st !== "scheduled") return st;
    const now = new Date();
    if (s(t, "start_at") && now < new Date(s(t, "start_at"))) return "scheduled";
    if (s(t, "end_at") && now > new Date(s(t, "end_at"))) return "completed";
    return "active";
  };
  const statusPill = (st: string) => ({
    draft: "bg-slate-200 text-slate-600", scheduled: "bg-amber-100 text-amber-800",
    published: "bg-brand-tint text-brand-dark", active: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-200 text-slate-600", archived: "bg-slate-200 text-slate-500",
  }[st] || "bg-slate-200 text-slate-600");

  // ---------- Wizard: create / edit / publish ----------
  function startWizard() {
    setEditingTestId("");
    setWiz({
      title: "", description: "", batch_id: staffBatches[0] ? s(staffBatches[0], "id") : "", subject: "", topic: "", category: "Practice Test",
      difficulty: "Medium", passing_marks: "", instructions: "", thumbnail_url: "",
      duration_minutes: "60", start_at: "", end_at: "", max_attempts: "1",
      randomize_questions: false, randomize_options: false, allow_revisit: true,
      show_results: "immediate", show_answers: true, show_explanations: true,
    });
    setWizQs([]); setQForm(emptyQ()); setEditingQ(""); setImportRows([]); setImportError("");
    setWizStep(1); setWizOpen(true);
  }
  async function startEdit(test: Row) {
    const tid = s(test, "id");
    const hasAttempts = (attemptCounts[tid] || 0) > 0;
    if (hasAttempts) { say("This test already has attempts — its questions and settings are locked. You can archive it or publish its results."); return; }
    const { data: qs } = await supabase.from("test_questions").select("*").eq("test_id", tid).order("sort_order", { ascending: true });
    setEditingTestId(tid);
    setWiz({
      title: s(test, "title"), description: s(test, "description"), batch_id: s(test, "batch_id"),
      subject: s(test, "subject"), topic: s(test, "topic") || "", category: s(test, "category") || "Practice Test",
      difficulty: s(test, "difficulty") || "Medium", passing_marks: s(test, "passing_marks") || "",
      instructions: s(test, "instructions") || "", thumbnail_url: s(test, "thumbnail_url") || "",
      duration_minutes: String(test.duration_minutes ?? 60),
      start_at: s(test, "start_at") ? s(test, "start_at").slice(0, 16) : "",
      end_at: s(test, "end_at") ? s(test, "end_at").slice(0, 16) : "",
      max_attempts: String(test.max_attempts ?? 1),
      randomize_questions: test.randomize_questions === true,
      randomize_options: test.randomize_options === true,
      allow_revisit: test.allow_revisit !== false,
      show_results: s(test, "show_results") || "immediate",
      show_answers: test.show_answers !== false,
      show_explanations: test.show_explanations !== false,
    });
    setWizQs(((qs as Row[]) || []).map((q, i) => ({
      localId: uid(), question_text: s(q, "question_text"),
      question_type: (s(q, "question_type") || "single") as QType,
      options: LABELS.map(l => ({ label: l, text: s(((Array.isArray(q.options) ? q.options : []) as Row[]).find(o => String(o.label) === l), "text") })),
      correct: (Array.isArray(q.correct_answers) ? q.correct_answers : []).map(String),
      explanation: s(q, "explanation"), marks: n(q, "marks") || 1, negative_marks: n(q, "negative_marks") || 0,
      difficulty: s(q, "difficulty") || "Medium", subject: s(q, "subject"), topic: s(q, "topic"),
      bankId: s(q, "question_bank_id") || undefined, saveToBank: false,
    })));
    setWizStep(1); setWizOpen(true);
  }
  function totalMarksOf(qs: QDraft[]) { return qs.reduce((a, q) => a + (q.marks || 0), 0); }
  async function saveWizard(publish: boolean) {
    if (!wiz.title.trim()) return say("Give the test a title first.");
    if (!wiz.batch_id) return say("Pick a batch for this test.");
    if (!wizQs.length) return say("Add at least one question before saving.");
    const bad = wizQs.map(validateDraft).find(Boolean);
    if (bad) return say(`Fix the questions first: ${bad}`);
    setBusy(true);
    try {
      const total = totalMarksOf(wizQs);
      const status = publish ? (wiz.start_at && new Date(wiz.start_at) > new Date() ? "scheduled" : "published") : "draft";
      const payload: Record<string, unknown> = {
        batch_id: wiz.batch_id, title: wiz.title.trim(), subject: wiz.subject.trim() || null,
        description: wiz.description.trim() || null, category: wiz.category, difficulty: wiz.difficulty,
        total_marks: total, test_date: wiz.start_at ? wiz.start_at.slice(0, 10) : null,
        duration_minutes: Number(wiz.duration_minutes) || 60,
        start_at: wiz.start_at ? new Date(wiz.start_at).toISOString() : null,
        end_at: wiz.end_at ? new Date(wiz.end_at).toISOString() : null,
        max_attempts: Number(wiz.max_attempts) || 1,
        randomize_questions: wiz.randomize_questions, randomize_options: wiz.randomize_options,
        allow_revisit: wiz.allow_revisit, show_results: wiz.show_results,
        show_answers: wiz.show_answers, show_explanations: wiz.show_explanations,
        passing_marks: wiz.passing_marks === "" ? null : Number(wiz.passing_marks),
        instructions: wiz.instructions.trim() || null, status,
        thumbnail_url: wiz.thumbnail_url.trim() || null,
        published_at: publish ? new Date().toISOString() : null,
      };
      let testId = editingTestId;
      if (testId) {
        payload.created_by = undefined;
        const { error } = await supabase.from("tests").update(payload).eq("id", testId);
        if (error) throw error;
        await supabase.from("test_questions").delete().eq("test_id", testId);
      } else {
        payload.created_by = profile.id;
        const { data, error } = await supabase.from("tests").insert(payload).select("id").single();
        if (error || !data) throw error || new Error("Could not create the test.");
        testId = s(data, "id");
      }
      // Save new bank questions first (so test_questions can reference them).
      const bankIds: Record<string, string> = {};
      for (const q of wizQs) {
        if (q.saveToBank && !q.bankId) {
          const { data: b, error } = await supabase.from("question_bank").insert(draftToBankPayload(q, s(profile, "id"), wiz.batch_id)).select("id").single();
          if (!error && b) bankIds[q.localId] = s(b, "id");
        }
      }
      const rows = wizQs.map((q, i) => draftToTestQ({ ...q, bankId: q.bankId || bankIds[q.localId] }, testId, i));
      const { error: qErr } = await supabase.from("test_questions").insert(rows);
      if (qErr) throw qErr;
      setWizOpen(false); setEditingTestId("");
      say(publish ? `Test ${status === "scheduled" ? "scheduled" : "published"} — ${wizQs.length} questions, ${total} marks.` : "Draft saved.");
      loadAll(); refreshModule();
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Could not save the test."); }
    finally { setBusy(false); }
  }
  async function setTestStatus(test: Row, status: string) {
    const { error } = await supabase.from("tests").update({ status, published_at: status === "published" ? new Date().toISOString() : s(test, "published_at") || null }).eq("id", s(test, "id"));
    if (error) say(error.message); else { say(`Test ${status}.`); loadAll(); refreshModule(); }
  }
  async function deleteTest(test: Row) {
    const tid = s(test, "id");
    if ((attemptCounts[tid] || 0) > 0) return say("This test has attempts and cannot be deleted — archive it instead.");
    if (!window.confirm(`Delete "${s(test, "title")}"? Its questions will be deleted too.`)) return;
    const { error } = await supabase.from("tests").delete().eq("id", tid);
    if (error) say(error.message); else { say("Test deleted."); loadAll(); refreshModule(); }
  }
  async function publishResults(test: Row) {
    const { error } = await supabase.from("tests").update({ results_published: true }).eq("id", s(test, "id"));
    if (error) say(error.message); else { say("Results published — students can now see their scores."); loadAll(); }
  }
  async function saveManualMarks(testId: string) {
    const stu = mmStu[testId]; const marks = mmMarks[testId];
    if (!stu || !marks) return say("Pick a student and enter marks.");
    const { error } = await supabase.from("test_results").upsert({ test_id: testId, student_id: stu, marks: Number(marks), remarks: mmRem[testId] || "" }, { onConflict: "test_id,student_id" });
    if (error) say(error.message); else { say("Marks saved."); loadAll(); }
  }

  // ---------- Question editor (wizard) ----------
  function saveQForm() {
    const err = validateDraft(qForm);
    if (err) return say(err);
    if (editingQ) {
      setWizQs(wizQs.map(q => q.localId === editingQ ? { ...qForm } : q));
      setEditingQ("");
    } else setWizQs([...wizQs, { ...qForm }]);
    setQForm(emptyQ(wiz.subject, wiz.topic));
    say(editingQ ? "Question updated." : "Question added to the test.");
  }
  function editQ(q: QDraft) { setQForm({ ...q, options: q.options.map(o => ({ ...o })) }); setEditingQ(q.localId); setQTab("manual"); }
  function dupQ(q: QDraft) { setWizQs([...wizQs, { ...q, localId: uid(), bankId: undefined }]); }
  function delQ(localId: string) { setWizQs(wizQs.filter(q => q.localId !== localId)); }
  function moveQ(localId: string, dir: -1 | 1) {
    const i = wizQs.findIndex(q => q.localId === localId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= wizQs.length) return;
    const arr = [...wizQs]; [arr[i], arr[j]] = [arr[j], arr[i]];
    setWizQs(arr);
  }
  function addBankToTest() {
    const picked = bank.filter(b => bankSelected.has(s(b, "id")));
    if (!picked.length) return say("Select questions from the bank first.");
    setWizQs([...wizQs, ...picked.map(bankToDraft)]);
    setBankSelected(new Set());
    say(`${picked.length} question${picked.length > 1 ? "s" : ""} added to the test.`);
  }
  async function deleteBankQuestion(id: string) {
    if (!window.confirm("Delete this question from the bank? Tests already created keep their own copy.")) return;
    const { error } = await supabase.from("question_bank").update({ is_active: false }).eq("id", id);
    if (error) say(error.message); else { say("Question removed from the bank."); refreshModule(); }
  }
  async function saveBankQ() {
    const err = validateDraft(qForm);
    if (err) return say(err);
    const payload = draftToBankPayload(qForm, s(profile, "id"), null);
    const { error } = bankEditing
      ? await supabase.from("question_bank").update(payload).eq("id", bankEditing)
      : await supabase.from("question_bank").insert(payload);
    if (error) { say(error.message); return; }
    setQForm(emptyQ()); setBankEditing(""); setShowBankEditor(false);
    say(bankEditing ? "Bank question updated." : "Question saved to the bank.");
    refreshModule();
  }

  // ---------- Bulk import ----------
  async function onImportFile(file: File | undefined, target: "wizard" | "bank") {
    if (!file) return;
    setImportError(""); setImportRows([]); setImportBusy(true);
    try {
      let rows: ImportRow[] = [];
      if (/\.xlsx$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        rows = json.map(o => ({
          question: s(o, "question") || s(o, "question_text"),
          question_type: s(o, "question_type"),
          option_a: s(o, "option_a"), option_b: s(o, "option_b"), option_c: s(o, "option_c"), option_d: s(o, "option_d"),
          correct_answer: s(o, "correct_answer"),
          explanation: s(o, "explanation"), marks: s(o, "marks"), negative_marks: s(o, "negative_marks"),
          difficulty: s(o, "difficulty"), subject: s(o, "subject"), topic: s(o, "topic"),
        }));
      } else {
        const text = await file.text();
        const parsed = parseImportText(text, file.name);
        if (parsed.error) { setImportError(parsed.error); return; }
        rows = parsed.rows;
      }
      if (!rows.length) { setImportError("No questions found in this file."); return; }
      const existing = new Set(bank.map(b => s(b, "question_text").toLowerCase()));
      const parsedRows = rowsToDrafts(rows, existing);
      setImportRows(parsedRows.map(r => ({ ...r, target } as ParsedRow & { target?: string })));
      const valid = parsedRows.filter(r => !r.errors.length).length;
      say(`${valid} valid, ${parsedRows.length - valid} invalid out of ${parsedRows.length} rows. Review and import the valid ones.`);
    } catch (e: unknown) { setImportError(e instanceof Error ? e.message : "Could not read this file."); }
    finally { setImportBusy(false); }
  }
  async function importValid(target: "wizard" | "bank") {
    const valid = importRows.filter(r => !r.errors.length && r.draft);
    if (!valid.length) return say("No valid questions to import.");
    setImportBusy(true);
    try {
      if (target === "bank") {
        const payloads = valid.map(r => draftToBankPayload(r.draft!, s(profile, "id"), null));
        const { error } = await supabase.from("question_bank").insert(payloads);
        if (error) throw error;
        say(`${valid.length} question${valid.length > 1 ? "s" : ""} imported into the Question Bank.`);
        refreshModule();
      } else {
        setWizQs([...wizQs, ...valid.map(r => r.draft!)]);
        say(`${valid.length} question${valid.length > 1 ? "s" : ""} added to the test draft.`);
      }
      setImportRows([]);
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Import failed."); }
    finally { setImportBusy(false); }
  }

  // ---------- Student exam ----------
  async function startTest(test: Row) {
    setExamBusy(true); setLocalMsg("");
    try {
      const res = await fetch("/api/tests/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_id: s(test, "id") }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not start the test.");
      const answers: Record<string, string[]> = {};
      const texts: Record<string, string> = {};
      for (const a of (j.saved_answers as { question_id: string; selected: string[]; answer_text?: string }[]) || []) {
        answers[a.question_id] = a.selected;
        if (a.answer_text) texts[a.question_id] = a.answer_text;
      }
      const qs = (j.questions as Row[]) || [];
      submitGuard.current = false;
      setExam({
        test, attemptId: j.attempt.id, expiresAt: j.attempt.expires_at, attemptNo: j.attempt.attempt_number,
        questions: qs, answers, texts, marked: [], visited: qs.length ? [s(qs[0], "id")] : [], current: 0, saving: false, confirmSubmit: false,
      });
      setInstrTest(null);
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Could not start the test."); }
    finally { setExamBusy(false); }
  }
  async function saveAnswer(qid: string, selected: string[]) {
    if (!exam) return;
    setExam({ ...exam, answers: { ...exam.answers, [qid]: selected }, saving: true });
    try {
      await fetch("/api/tests/answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: exam.attemptId, question_id: qid, selected }),
      });
    } catch { /* autosave retries on next change */ }
    const cur = examRef.current;
    if (cur) setExam({ ...cur, saving: false });
  }
  // Descriptive answers: update local text immediately, autosave debounced
  // (800 ms after the last keystroke) so typing never waits on the network.
  // The pending save is flushed when the student leaves the question.
  function saveTextAnswer(qid: string, text: string) {
    if (!exam) return;
    setExam({ ...exam, texts: { ...exam.texts, [qid]: text }, saving: true });
    const timers = textSaveTimers.current;
    if (timers[qid]) clearTimeout(timers[qid]);
    timers[qid] = setTimeout(() => {
      const cur = examRef.current;
      if (!cur) return;
      void fetch("/api/tests/answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: cur.attemptId, question_id: qid, selected: [], answer_text: text }),
      }).catch(() => { /* autosave retries on next change */ })
        .finally(() => { const c = examRef.current; if (c) setExam({ ...c, saving: false }); });
    }, 800);
  }
  function flushTextAnswer(qid: string): Promise<void> {
    const timers = textSaveTimers.current;
    if (!timers[qid]) return Promise.resolve();
    clearTimeout(timers[qid]);
    delete timers[qid];
    const cur = examRef.current;
    if (!cur) return Promise.resolve();
    const text = cur.texts[qid] || "";
    return fetch("/api/tests/answer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt_id: cur.attemptId, question_id: qid, selected: [], answer_text: text }),
    }).catch(() => { /* autosave retries on next change */ })
      .then(() => { const c = examRef.current; if (c) setExam({ ...c, saving: false }); });
  }
  // Clear a descriptive answer (local text + server row).
  function clearTextAnswer(qid: string) {
    if (!exam) return;
    const timers = textSaveTimers.current;
    if (timers[qid]) { clearTimeout(timers[qid]); delete timers[qid]; }
    setExam({ ...exam, texts: { ...exam.texts, [qid]: "" }, saving: true });
    void fetch("/api/tests/answer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt_id: exam.attemptId, question_id: qid, selected: [], answer_text: "" }),
    }).catch(() => { /* autosave retries on next change */ })
      .finally(() => { const c = examRef.current; if (c) setExam({ ...c, saving: false }); });
  }
  function toggleOption(q: Row, label: string) {
    if (!exam) return;
    const qid = s(q, "id");
    const prev = exam.answers[qid] || [];
    const next = s(q, "question_type") === "multiple"
      ? (prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])
      : [label];
    void saveAnswer(qid, next);
  }
  async function submitExam(auto = false) {
    const cur = examRef.current;
    if (!cur || submitGuard.current) return;
    submitGuard.current = true;
    try {
      // Flush any debounced descriptive autosave so the last keystrokes are
      // stored before the attempt is scored.
      await Promise.all(Object.keys(textSaveTimers.current).map(qid => flushTextAnswer(qid)));
      const res = await fetch("/api/tests/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: cur.attemptId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not submit.");
      const r = await fetch(`/api/tests/results?test_id=${encodeURIComponent(s(cur.test, "id"))}`);
      const rj = await r.json().catch(() => ({}));
      setMyResult({ ...rj, test: cur.test, auto });
      setExam(null);
      say(auto ? "Time expired — your test was submitted automatically." : "Test submitted.");
      refreshModule();
    } catch (e: unknown) {
      submitGuard.current = false;
      say(e instanceof Error ? e.message : "Could not submit.");
    }
  }
  // Countdown: the SERVER expires_at is the source of truth; this is display only.
  useEffect(() => {
    if (!exam) return;
    const tick = () => {
      const cur = examRef.current;
      if (!cur) return;
      const remaining = Math.floor((new Date(cur.expiresAt).getTime() - Date.now()) / 1000);
      if (remaining <= 0) void submitExam(true);
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [exam?.attemptId]);
  const examRemaining = exam ? Math.max(0, Math.floor((new Date(exam.expiresAt).getTime() - Date.now()) / 1000)) : 0;

  async function loadMyResult(testId: string) {
    setResBusy(true);
    try {
      const r = await fetch(`/api/tests/results?test_id=${encodeURIComponent(testId)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not load result.");
      setMyResult({ ...j, test: tests.find(t => s(t, "id") === testId) || null });
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Could not load result."); }
    finally { setResBusy(false); }
  }
  async function loadTeacherResults(testId: string) {
    setResTestId(testId); setResBusy(true);
    try {
      const r = await fetch(`/api/tests/results?test_id=${encodeURIComponent(testId)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not load results.");
      setResData(j);
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Could not load results."); }
    finally { setResBusy(false); }
  }
  // ---------- Manual grading (descriptive answers) ----------
  async function loadGrading(testId: string, attemptId: string) {
    setGradingAttemptId(attemptId); setGradingData(null); setGradeMarks({}); setGradeBusy(true);
    try {
      const r = await fetch(`/api/tests/results?test_id=${encodeURIComponent(testId)}&attempt_id=${encodeURIComponent(attemptId)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not load the attempt.");
      const g = (j.grading as Row) || null;
      setGradingData(g);
      if (g) {
        const preset: Record<string, string> = {};
        for (const a of ((g.answers as Row[]) || [])) {
          if (a.manual_marks !== null && a.manual_marks !== undefined) preset[s(a, "question_id")] = String(a.manual_marks);
        }
        setGradeMarks(preset);
      }
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Could not load the attempt."); }
    finally { setGradeBusy(false); }
  }
  async function saveGrade(questionId: string, maxMarks: number) {
    if (!gradingData) return;
    const raw = (gradeMarks[questionId] ?? "").trim();
    const marks = Number(raw);
    if (raw === "" || !Number.isFinite(marks) || marks < 0 || marks > maxMarks) {
      return say(`Enter marks between 0 and ${maxMarks} for this answer.`);
    }
    setGradeBusy(true);
    try {
      const r = await fetch("/api/tests/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: s(gradingData, "attempt_id"), question_id: questionId, marks }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not save the grade.");
      say(`Grade saved — attempt total is now ${j.attempt.score} / ${j.attempt.max_marks}${j.attempt.pending_manual ? " (still awaiting grading on other answers)" : " (grading complete)"}.`);
      await loadGrading(resTestId, s(gradingData, "attempt_id"));
      await loadTeacherResults(resTestId);
      refreshModule();
    } catch (e: unknown) { say(e instanceof Error ? e.message : "Could not save the grade."); }
    finally { setGradeBusy(false); }
  }
  function downloadResultsCsv() {
    if (!resData) return;
    const atts = (resData.attempts as Row[]) || [];
    const lines = [["Student", "Attempt", "Score", "Max marks", "Percentage", "Passed", "Needs grading", "Time taken (s)", "Submitted at"].join(",")];
    for (const a of atts) {
      lines.push([nameOf(s(a, "student_id")), String(a.attempt_number), String(a.score), String(a.max_marks), String(a.percentage), a.passed ? "Pass" : "Fail", a.manual_grading_pending ? "Yes" : "No", String(a.time_taken_seconds), s(a, "submitted_at")].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    downloadText(`test-results-${resTestId}.csv`, lines.join("\n"));
  }

  // ---------- Derived lists ----------
  const bankFiltered = useMemo(() => bank.filter(b => {
    if (s(b, "is_active") === "false") return false;
    if (bankSearch && !(s(b, "question_text") + " " + s(b, "topic")).toLowerCase().includes(bankSearch.toLowerCase())) return false;
    if (bankSubject && s(b, "subject") !== bankSubject) return false;
    if (bankTopic && s(b, "topic") !== bankTopic) return false;
    if (bankDifficulty && s(b, "difficulty") !== bankDifficulty) return false;
    if (bankType && s(b, "question_type") !== bankType) return false;
    return true;
  }), [bank, bankSearch, bankSubject, bankTopic, bankDifficulty, bankType]);
  const bankSubjects = useMemo(() => Array.from(new Set(bank.map(b => s(b, "subject")).filter(Boolean))), [bank]);
  const bankTopics = useMemo(() => Array.from(new Set(bank.map(b => s(b, "topic")).filter(Boolean))), [bank]);

  const studentTests = visibleStudentTests.map(t => {
    const la = latestAttempt(s(t, "id"));
    const submitted = la && (s(la, "status") === "submitted" || s(la, "status") === "expired");
    const inProgress = la && s(la, "status") === "in_progress" && (!s(la, "expires_at") || new Date(s(la, "expires_at")) > new Date());
    const now = new Date();
    const live = testStatus(t) === "active";
    const upcoming = !!s(t, "start_at") && now < new Date(s(t, "start_at"));
    return { t, la, submitted: !!submitted, inProgress: !!inProgress, live, upcoming };
  });
  const legacyResults = (data.test_results || []).filter(r => s(r, "student_id") === effectiveId);

  // ---------- Exam screen (takes over the section while an attempt is live) ----------
  if (exam) {
    const q = exam.questions[exam.current];
    const qid = q ? s(q, "id") : "";
    const sel = (exam.answers[qid] || []) as string[];
    const isDesc = (x: Row) => s(x, "question_type") === "descriptive";
    // Descriptive questions count as answered once any text is typed.
    const isAnswered = (x: Row) => isDesc(x)
      ? (exam.texts[s(x, "id")] || "").trim().length > 0
      : (exam.answers[s(x, "id")] || []).length > 0;
    const answered = exam.questions.filter(isAnswered).length;
    const markedCount = exam.marked.length;
    const notVisited = exam.questions.filter(x => !exam.visited.includes(s(x, "id"))).length;
    const statusOf = (x: Row) => {
      const id = s(x, "id");
      const a = isAnswered(x);
      const m = exam.marked.includes(id);
      if (a && m) return "answered-marked";
      if (a) return "answered";
      if (m) return "marked";
      if (!exam.visited.includes(id)) return "not-visited";
      return "not-answered";
    };
    const pillCls: Record<string, string> = {
      "answered": "bg-emerald-500 text-white", "answered-marked": "bg-violet-500 text-white",
      "marked": "bg-amber-400 text-white", "not-answered": "bg-red-100 text-red-700", "not-visited": "bg-slate-200 text-slate-600",
    };
    const goTo = (i: number) => {
      if (i < 0 || i >= exam.questions.length) return;
      // Save any typed descriptive text before leaving this question.
      if (qid) void flushTextAnswer(qid);
      const id = s(exam.questions[i], "id");
      setExam({ ...exam, current: i, visited: exam.visited.includes(id) ? exam.visited : [...exam.visited, id] });
    };
    return (
      <div>
        <div className="sticky top-14 z-30 -mx-1 rounded-2xl border bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0"><b className="block truncate text-sm">{s(exam.test, "title")}</b><span className="text-xs text-slate-500">Attempt {exam.attemptNo} · {exam.questions.length} questions · {answered} answered</span></div>
            <div className="flex items-center gap-2">
              <span className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-extrabold ${examRemaining < 300 ? "bg-red-100 text-red-700" : "bg-brand-tint text-brand-dark"}`}><Timer className="h-4 w-4" />{fmtClock(examRemaining)}</span>
              {exam.saving && <span className="text-xs font-bold text-slate-400">Saving…</span>}
              <button onClick={() => setExam({ ...exam, confirmSubmit: true })} className="btn-brand shrink-0 !py-2 text-xs">Submit test</button>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="card !p-4 sm:!p-5">
            {q ? <>
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Question {exam.current + 1} of {exam.questions.length} · {s(q, "subject")} {s(q, "topic") ? `· ${s(q, "topic")}` : ""} · {n(q, "marks")} mark{n(q, "marks") !== 1 ? "s" : ""}{n(q, "negative_marks") > 0 ? ` · −${n(q, "negative_marks")} negative` : ""}{isDesc(q) ? " · Descriptive" : ""}</p>
              <p className="mt-2 text-base font-bold leading-relaxed">{s(q, "question_text")}</p>
              {s(q, "question_type") === "multiple" && <p className="mt-1 text-xs font-bold text-brand-dark">Select all correct options.</p>}
              {isDesc(q) ? <>
                <p className="mt-1 text-xs font-bold text-amber-800">Descriptive answer — write in your own words. Your teacher grades it after you submit; it counts as 0 until graded.</p>
                <textarea
                  className="mt-4 min-h-[160px] w-full resize-y rounded-2xl border-2 border-slate-200 bg-white p-3 text-base leading-relaxed focus:border-brand focus:outline-none"
                  rows={6}
                  value={exam.texts[qid] || ""}
                  onChange={e => saveTextAnswer(qid, e.target.value)}
                  onBlur={() => void flushTextAnswer(qid)}
                  placeholder="Write your answer here…"
                  aria-label="Your answer"
                />
                <p className="mt-1 text-right text-xs text-slate-400">{(exam.texts[qid] || "").trim().length} characters · saves automatically as you type</p>
              </> : (
              <div className="mt-4 space-y-2">
                {((q.options as { label: string; text: string }[]) || []).map(o => {
                  const on = sel.includes(o.label);
                  return <button key={o.label} onClick={() => toggleOption(q, o.label)} className={`app-press flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${on ? "border-brand bg-brand-tint" : "border-slate-200 bg-white"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold ${on ? "border-brand bg-brand text-white" : "border-slate-300 text-slate-500"}`}>{o.label}</span>
                    <span className="text-sm font-semibold">{o.text}</span>
                  </button>;
                })}
              </div>)}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => goTo(exam.current - 1)} disabled={exam.current === 0} className="app-press flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-40 sm:flex-none"><ChevronLeft className="inline h-4 w-4" /> Previous</button>
                <button onClick={() => goTo(exam.current + 1)} disabled={exam.current === exam.questions.length - 1} className="app-press flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-40 sm:flex-none">Next <ChevronRight className="inline h-4 w-4" /></button>
                <button onClick={() => setExam({ ...exam, marked: exam.marked.includes(qid) ? exam.marked.filter(x => x !== qid) : [...exam.marked, qid] })} className={`app-press flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold sm:flex-none ${exam.marked.includes(qid) ? "border-amber-400 bg-amber-50 text-amber-800" : ""}`}><Flag className="inline h-4 w-4" /> {exam.marked.includes(qid) ? "Unmark review" : "Mark for review"}</button>
                <button onClick={() => { if (isDesc(q)) clearTextAnswer(qid); else void saveAnswer(qid, []); }} disabled={!sel.length && !(exam.texts[qid] || "").trim()} className="app-press flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-40 sm:flex-none">Clear response</button>
              </div>
            </> : <p className="text-sm text-slate-500">No questions in this test.</p>}
          </div>
          <div className="card !p-4">
            <b className="text-sm">Question palette</b>
            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2 lg:grid-cols-4">
              {exam.questions.map((x, i) => <button key={s(x, "id")} onClick={() => goTo(i)} aria-label={`Question ${i + 1} — ${statusOf(x)}`} className={`app-press flex h-10 items-center justify-center rounded-xl text-sm font-extrabold ${pillCls[statusOf(x)]} ${i === exam.current ? "ring-2 ring-ink ring-offset-1" : ""}`}>{i + 1}</button>)}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              <li><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500 align-middle" /> Answered ({answered})</li>
              <li><span className="mr-1 inline-block h-3 w-3 rounded bg-red-100 align-middle" /> Not answered ({exam.questions.length - answered - notVisited})</li>
              <li><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-400 align-middle" /> Marked for review ({markedCount})</li>
              <li><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-200 align-middle" /> Not visited ({notVisited})</li>
            </ul>
            <p className="mt-3 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-500">Your answers save automatically. If the page refreshes, use Resume to continue — the timer runs on the server, not on your phone.</p>
          </div>
        </div>
        {exam.confirmSubmit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-extrabold">Submit this test?</h3>
            <ul className="mt-3 space-y-1 text-sm">
              <li>Total questions: <b>{exam.questions.length}</b></li>
              <li>Answered: <b>{answered}</b></li>
              <li>Unanswered: <b>{exam.questions.length - answered}</b></li>
              <li>Marked for review: <b>{markedCount}</b></li>
              <li>Not visited: <b>{notVisited}</b></li>
              <li>Time left: <b>{fmtClock(examRemaining)}</b></li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">Once submitted you cannot change your answers.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => void submitExam(false)} className="btn-brand flex-1">Submit now</button>
              <button onClick={() => setExam({ ...exam, confirmSubmit: false })} className="flex-1 rounded-xl border px-4 py-3 font-bold">Keep writing</button>
            </div>
          </div>
        </div>}
      </div>
    );
  }

  // ---------- Instructions page (before starting) ----------
  if (instrTest) {
    const t = instrTest;
    const qCount = testQCounts[s(t, "id")] || 0;
    return (
      <div className="card mt-3 !p-5">
        <button onClick={() => setInstrTest(null)} className="text-sm font-bold text-brand-dark underline">← Back to tests</button>
        <h3 className="mt-3 text-xl font-extrabold">{s(t, "title")}</h3>
        <p className="mt-1 text-sm text-slate-600">{s(t, "description") || "No description."}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{qCount}</b><span className="block text-xs font-bold text-slate-500">Questions</span></div>
          <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{n(t, "duration_minutes") || 60} min</b><span className="block text-xs font-bold text-slate-500">Duration</span></div>
          <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{String(t.total_marks ?? "")}</b><span className="block text-xs font-bold text-slate-500">Total marks</span></div>
          <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{s(t, "passing_marks") ? `${s(t, "passing_marks")}` : "—"}</b><span className="block text-xs font-bold text-slate-500">Passing marks</span></div>
        </div>
        <div className="mt-4 space-y-1 text-sm text-slate-600">
          <p>Batch: <b>{batchName(s(t, "batch_id"))}</b> · Subject: <b>{s(t, "subject") || "—"}</b>{s(t, "topic") ? ` · Topic: ${s(t, "topic")}` : ""}</p>
          <p>Category: <b>{s(t, "category") || "—"}</b> · Difficulty: <b>{s(t, "difficulty") || "—"}</b></p>
          {s(t, "start_at") && <p>Starts: <b>{new Date(s(t, "start_at")).toLocaleString()}</b></p>}
          {s(t, "end_at") && <p>Ends: <b>{new Date(s(t, "end_at")).toLocaleString()}</b></p>}
          <p>Attempts allowed: <b>{n(t, "max_attempts") || 1}</b> · Used: <b>{attemptCounts[s(t, "id")] || 0}</b></p>
          <p>Negative marking: <b>{s(t, "show_results") ? "as per questions" : "—"}</b> · Results: <b>{s(t, "show_results") === "immediate" ? "shown immediately" : s(t, "show_results") === "after_publish" ? "after teacher publishes" : "hidden"}</b></p>
        </div>
        {s(t, "instructions") && <div className="mt-4 rounded-2xl bg-amber-50 p-4"><b className="text-sm">Instructions</b><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s(t, "instructions")}</p></div>}
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <b>Before you start:</b>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Answers save automatically as you go.</li>
            <li>The timer is set by the server — refreshing the page does not pause it.</li>
            <li>You can revisit questions if the test allows it.</li>
            <li>When time runs out, the test submits itself.</li>
            <li>Descriptive (written) answers are graded by your teacher after you submit — they count as 0 until graded.</li>
          </ul>
        </div>
        <button onClick={() => { if (window.confirm("Start the test now? The timer starts immediately.")) void startTest(t); }} disabled={examBusy} className="btn-brand mt-4 w-full sm:w-auto">{examBusy ? "Starting…" : "Start test →"}</button>
        {localMsg && <p className="mt-3 text-sm font-semibold text-amber-800">{localMsg}</p>}
      </div>
    );
  }

  // ---------- My result view (student) ----------
  if (myResult) {
    const r = (myResult.result as Row) || {};
    const review = (myResult.review as Row[]) || [];
    const test = (myResult.test as Row) || null;
    const released = myResult.released !== false;
    return (
      <div>
        <button onClick={() => { setMyResult(null); setResTestId(""); }} className="mt-3 text-sm font-bold text-brand-dark underline">← Back to tests</button>
        <div className="card mt-3 !p-5">
          <h3 className="text-lg font-extrabold">{test ? s(test, "title") : "Test result"}</h3>
          {myResult.auto === true && <p className="mt-1 text-sm font-bold text-amber-700">Auto-submitted when time expired.</p>}
          {!released && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Submitted. Your teacher will publish the results — scores are hidden for now.</p>}
          {released && <>
            {r.pending_manual === true && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Some descriptive answers are still awaiting manual grading — the score below is not final yet. It will update once your teacher grades them.</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-brand-tint p-3"><b className="text-xl">{String(r.score ?? "—")} / {String(r.max_marks ?? "")}</b><span className="block text-xs font-bold text-slate-500">Score{r.pending_manual === true ? " (provisional)" : ""}</span></div>
              <div className="rounded-2xl bg-slate-50 p-3"><b className="text-xl">{String(r.percentage ?? "—")}%</b><span className="block text-xs font-bold text-slate-500">Percentage</span></div>
              <div className="rounded-2xl bg-slate-50 p-3"><b className="text-xl">{r.passed ? "Passed ✓" : "Failed"}</b><span className="block text-xs font-bold text-slate-500">Result{r.pending_manual === true ? " (provisional)" : ""}</span></div>
              <div className="rounded-2xl bg-slate-50 p-3"><b className="text-xl">{fmtClock(n(r, "time_taken_seconds"))}</b><span className="block text-xs font-bold text-slate-500">Time taken</span></div>
            </div>
            {(r.auto_score !== undefined || r.manual_score !== undefined) && <p className="mt-2 text-xs text-slate-500">Auto-scored (MCQ): {String(r.auto_score ?? 0)} · Manually graded (descriptive): {String(r.manual_score ?? 0)}{r.pending_manual === true ? " · some descriptive answers still awaiting grading" : ""}</p>}
            {review.length > 0 && <div className="mt-5 space-y-3">
              <h4 className="font-extrabold">Question-wise review</h4>
              {review.map((q, i) => {
                if (s(q, "question_type") === "descriptive") {
                  const pending = q.pending_manual === true;
                  return <div key={s(q, "question_id")} className="rounded-2xl border p-4">
                    <p className="text-sm font-bold">Q{i + 1}. {s(q, "question_text")} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">Descriptive</span></p>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">{s(q, "answer_text") || "(No answer written.)"}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{pending ? "Awaiting grading — marks will appear here once your teacher grades this answer." : `Marks: ${String(q.manual_marks ?? 0)} / ${String(q.marks ?? "")}`}</p>
                    {q.explanation ? <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm"><b>Model answer:</b> {s(q, "explanation")}</p> : null}
                  </div>;
                }
                const correctAns = (q.correct_answers as string[]) || [];
                return <div key={s(q, "question_id")} className="rounded-2xl border p-4">
                  <p className="text-sm font-bold">Q{i + 1}. {s(q, "question_text")}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {((q.options as { label: string; text: string }[]) || []).map(o => {
                      const mine = ((q.selected as string[]) || []).includes(o.label);
                      const right = correctAns.includes(o.label);
                      return <li key={o.label} className={`rounded-lg px-3 py-1.5 ${right ? "bg-emerald-50 font-bold text-emerald-800" : mine ? "bg-red-50 font-bold text-red-700" : "bg-slate-50"}`}>{o.label}. {o.text}{right ? " ✓ Correct" : mine ? " — your answer" : ""}</li>;
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">Marks: {String(q.marks_awarded ?? 0)} / {String(q.marks ?? "")} · {q.is_correct ? "Correct" : "Incorrect / unattempted"}</p>
                  {q.explanation ? <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm"><b>Explanation:</b> {s(q, "explanation")}</p> : null}
                </div>;
              })}
            </div>}
          </>}
        </div>
      </div>
    );
  }

  // ---------- Shared small renderers ----------
  const qEditor = (saveLabel: string, onSave: () => void) => (
    <div className="rounded-2xl border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Question *</label><textarea required className="input" rows={3} value={qForm.question_text} onChange={e => setQForm({ ...qForm, question_text: e.target.value })} placeholder="Type the question…" /></div>
        <div><label className="label">Type</label><select className="input" value={qForm.question_type} onChange={e => setQForm({ ...qForm, question_type: e.target.value as QType, correct: [] })}><option value="single">Single correct answer</option><option value="multiple">Multiple correct answers</option><option value="descriptive">Descriptive / essay (manually graded)</option></select></div>
        <div><label className="label">Difficulty</label><select className="input" value={qForm.difficulty} onChange={e => setQForm({ ...qForm, difficulty: e.target.value })}>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        {qForm.question_type === "descriptive" && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 sm:col-span-2">Descriptive questions have no options and no correct answer. Students write free text, it scores 0 automatically, and you grade it by hand against the model answer below after they submit.</p>}
        {qForm.question_type !== "descriptive" && qForm.options.map((o, i) => (
          <div key={o.label}><label className="label">Option {o.label} {qForm.correct.includes(o.label) ? "· correct ✓" : ""}</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={o.text} onChange={e => { const opts = qForm.options.map((x, j) => j === i ? { ...x, text: e.target.value } : x); setQForm({ ...qForm, options: opts }); }} placeholder={`Option ${o.label}`} />
              <button type="button" onClick={() => setQForm({ ...qForm, correct: qForm.question_type === "single" ? [o.label] : qForm.correct.includes(o.label) ? qForm.correct.filter(x => x !== o.label) : [...qForm.correct, o.label] })} className={`app-press shrink-0 rounded-xl border px-3 text-xs font-extrabold ${qForm.correct.includes(o.label) ? "border-brand bg-brand text-white" : ""}`} aria-pressed={qForm.correct.includes(o.label)}>Correct</button>
            </div>
          </div>
        ))}
        <div><label className="label">Marks</label><input type="number" min="0" step="0.5" className="input" value={qForm.marks} onChange={e => setQForm({ ...qForm, marks: Number(e.target.value) || 0 })} /></div>
        {qForm.question_type !== "descriptive" && <div><label className="label">Negative marks (per wrong answer)</label><input type="number" min="0" step="0.25" className="input" value={qForm.negative_marks} onChange={e => setQForm({ ...qForm, negative_marks: Number(e.target.value) || 0 })} /></div>}
        <div><label className="label">Subject</label><input className="input" value={qForm.subject} onChange={e => setQForm({ ...qForm, subject: e.target.value })} placeholder="e.g. Mathematics" /></div>
        <div><label className="label">Topic / Chapter</label><input className="input" value={qForm.topic} onChange={e => setQForm({ ...qForm, topic: e.target.value })} placeholder="e.g. Algebra" /></div>
        <div className="sm:col-span-2"><label className="label">{qForm.question_type === "descriptive" ? "Model answer / grading guidance (teacher only)" : "Explanation (shown in results when allowed)"}</label><textarea className="input" rows={2} value={qForm.explanation} onChange={e => setQForm({ ...qForm, explanation: e.target.value })} placeholder={qForm.question_type === "descriptive" ? "What should a full-marks answer cover? This is never shown to students before grading, and only in results if the test's “Show explanations” is on." : "Why is this the right answer?"} /></div>
        <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={qForm.saveToBank !== false} onChange={e => setQForm({ ...qForm, saveToBank: e.target.checked })} /> Save this question to the Question Bank for reuse</label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onSave} className="btn-brand !py-2.5 text-sm">{saveLabel}</button>
        {editingQ && <button onClick={() => { setEditingQ(""); setQForm(emptyQ(wiz.subject, wiz.topic)); }} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Cancel edit</button>}
        <button onClick={() => setQPreview(!qPreview)} className="rounded-xl border px-4 py-2.5 text-sm font-bold"><Eye className="mr-1 inline h-4 w-4" />{qPreview ? "Hide preview" : "Preview"}</button>
      </div>
      {qPreview && qForm.question_text && <div className="mt-3 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-bold">{qForm.question_text}</p>
        {qForm.question_type === "descriptive" ? <>
          <p className="mt-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-3 text-sm text-slate-400">Student writes their answer here… ({qForm.marks} marks, manually graded)</p>
          {qForm.explanation && <p className="mt-2 text-sm text-slate-600"><b>Model answer (teacher only):</b> {qForm.explanation}</p>}
        </> : <>
          <ul className="mt-2 space-y-1 text-sm">{qForm.options.filter(o => o.text.trim()).map(o => <li key={o.label} className={qForm.correct.includes(o.label) ? "font-bold text-emerald-700" : ""}>{o.label}. {o.text}{qForm.correct.includes(o.label) ? " ✓" : ""}</li>)}</ul>
          {qForm.explanation && <p className="mt-2 text-sm text-slate-600"><b>Explanation:</b> {qForm.explanation}</p>}
        </>}
      </div>}
    </div>
  );

  const importPanel = (target: "wizard" | "bank") => {
    const valid = importRows.filter(r => !r.errors.length).length;
    return (
      <div className="rounded-2xl border p-4">
        <p className="text-sm font-bold">Bulk import — CSV, Excel (.xlsx) or JSON</p>
        <p className="mt-1 text-xs text-slate-500">Columns: question, question_type (single / multiple / descriptive), option_a, option_b, option_c, option_d, correct_answer (A–D), explanation, marks, negative_marks, difficulty (Easy/Medium/Hard), subject, topic. Descriptive rows need no options and no correct_answer — put the model answer / grading guidance in explanation instead. Only valid rows are imported — invalid rows are listed below, never silently skipped.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => downloadText("sample-questions.csv", SAMPLE_CSV)} className="app-press rounded-xl border px-4 py-2.5 text-sm font-bold"><Download className="mr-1 inline h-4 w-4" />Sample CSV template</button>
          <label className="app-press cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-bold"><FileUp className="mr-1 inline h-4 w-4" />Choose file…<input type="file" accept=".csv,.json,.xlsx,.xls" className="hidden" onChange={e => { void onImportFile(e.target.files?.[0], target); e.target.value = ""; }} /></label>
        </div>
        {importBusy && <p className="mt-2 text-sm font-bold text-brand-dark">Reading file…</p>}
        {importError && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{importError}</p>}
        {importRows.length > 0 && <>
          <p className="mt-3 text-sm font-bold">{valid} valid · {importRows.length - valid} invalid of {importRows.length} rows</p>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {importRows.map((r, i) => <div key={i} className={`rounded-xl border p-3 text-sm ${r.errors.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
              <p className="font-bold">{r.row.question || "(empty question)"}</p>
              {r.errors.length ? <p className="mt-1 text-xs font-semibold text-red-700">{r.errors.join(" ")}</p> : <p className="mt-1 text-xs text-slate-500">{r.draft?.question_type === "descriptive" ? `Descriptive · manually graded · ${r.row.marks} marks` : `${r.row.option_a} / ${r.row.option_b} / ${r.row.option_c} / ${r.row.option_d} · Correct: ${r.row.correct_answer} · ${r.row.marks} marks`}</p>}
            </div>)}
          </div>
          <button onClick={() => void importValid(target)} disabled={!valid || importBusy} className="btn-brand mt-3 !py-2.5 text-sm disabled:opacity-40">Import {valid} valid question{valid === 1 ? "" : "s"}{target === "bank" ? " into the bank" : " into this test"}</button>
        </>}
      </div>
    );
  };

  const bankPicker = () => (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Search questions…" value={bankSearch} onChange={e => setBankSearch(e.target.value)} />
        </div>
        <select className="input" value={bankSubject} onChange={e => setBankSubject(e.target.value)}><option value="">All subjects</option>{bankSubjects.map(x => <option key={x} value={x}>{x}</option>)}</select>
        <select className="input" value={bankTopic} onChange={e => setBankTopic(e.target.value)}><option value="">All topics</option>{bankTopics.map(x => <option key={x} value={x}>{x}</option>)}</select>
        <select className="input" value={bankDifficulty} onChange={e => setBankDifficulty(e.target.value)}><option value="">Any difficulty</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select>
        <select className="input" value={bankType} onChange={e => setBankType(e.target.value)}><option value="">Any type</option><option value="single">Single correct</option><option value="multiple">Multiple correct</option><option value="descriptive">Descriptive / essay</option></select>
      </div>
      <p className="mt-2 text-xs text-slate-500">{bankFiltered.length} question{bankFiltered.length === 1 ? "" : "s"} · {bankSelected.size} selected</p>
      <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
        {bankFiltered.length === 0 && <p className="card text-sm text-slate-500">No questions match. Add some with the manual editor or bulk import.</p>}
        {bankFiltered.map(b => {
          const id = s(b, "id");
          const on = bankSelected.has(id);
          return <button key={id} onClick={() => setBankSelected(prev => { const next = new Set(prev); if (on) next.delete(id); else next.add(id); return next; })} className={`app-press flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${on ? "border-brand bg-brand-tint" : "border-slate-200 bg-white"}`}>
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{s(b, "question_text")}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{s(b, "subject")} {s(b, "topic") ? `· ${s(b, "topic")}` : ""} · {s(b, "difficulty")} · {n(b, "marks")} marks · {Q_TYPE_LABEL[(s(b, "question_type") || "single") as QType]}</span></span>
          </button>;
        })}
      </div>
      <button onClick={addBankToTest} disabled={!bankSelected.size} className="btn-brand mt-3 !py-2.5 text-sm disabled:opacity-40">Add {bankSelected.size} selected to this test</button>
    </div>
  );

  // ---------- Teacher view ----------
  if (isStaff) {
    const staffTabs = [
      { k: "tests", l: `My Tests (${myTests.length})` },
      { k: "create", l: "Create Test" },
      { k: "bank", l: `Question Bank (${bank.length})` },
      { k: "results", l: "Results" },
    ];
    return (
      <div>
        <div className="card mt-3 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-extrabold">Tests &amp; Assessments</h3><p className="text-sm text-slate-600">Create MCQ and descriptive exams, reuse the question bank, publish to your batches, grade written answers, and see results.</p></div>
            <button onClick={() => { setTab("create"); startWizard(); }} className="btn-brand !py-2.5 text-sm"><Plus className="mr-1 inline h-4 w-4" />Create test</button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Test sections">
            {staffTabs.map(t => <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)} className={`app-press shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${tab === t.k ? "bg-brand text-white" : "bg-slate-200"}`}>{t.l}</button>)}
          </div>
          {localMsg && <p className="mt-2 text-sm font-semibold text-amber-800">{localMsg}</p>}
        </div>

        {tab === "create" && wizOpen && (
          <div className="card mt-3 !p-4 sm:!p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold">{editingTestId ? "Edit test" : "Create test"} — Step {wizStep} of 4</h3>
              <button onClick={() => setWizOpen(false)} className="app-press flex h-9 w-9 items-center justify-center rounded-xl border" aria-label="Close wizard"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["Basic info", "Questions", "Settings", "Preview & publish"] as const).map((l, i) => (
                <button key={l} onClick={() => setWizStep(i + 1)} className={`app-press shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${wizStep === i + 1 ? "bg-brand text-white" : wizStep > i + 1 ? "bg-brand-tint text-brand-dark" : "bg-slate-200"}`}>{i + 1}. {l}</button>
              ))}
            </div>

            {wizStep === 1 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="label">Test title *</label><input required className="input" value={wiz.title} onChange={e => setWiz({ ...wiz, title: e.target.value })} placeholder="e.g. Algebra — Chapter Test 1" /></div>
              <div><label className="label">Batch *</label><select required className="input" value={wiz.batch_id} onChange={e => setWiz({ ...wiz, batch_id: e.target.value })}><option value="">— pick a batch —</option>{staffBatches.map(b => <option key={s(b, "id")} value={s(b, "id")}>{s(b, "name")}</option>)}</select></div>
              <div><label className="label">Subject</label><input className="input" value={wiz.subject} onChange={e => setWiz({ ...wiz, subject: e.target.value })} placeholder="e.g. Mathematics" /></div>
              <div><label className="label">Chapter / Topic</label><input className="input" value={wiz.topic} onChange={e => setWiz({ ...wiz, topic: e.target.value })} placeholder="e.g. Quadratic Equations" /></div>
              <div><label className="label">Category</label><select className="input" value={wiz.category} onChange={e => setWiz({ ...wiz, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="label">Difficulty</label><select className="input" value={wiz.difficulty} onChange={e => setWiz({ ...wiz, difficulty: e.target.value })}>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><label className="label">Passing marks (optional)</label><input type="number" min="0" className="input" value={wiz.passing_marks} onChange={e => setWiz({ ...wiz, passing_marks: e.target.value })} placeholder="e.g. 20" /></div>
              <div><label className="label">Thumbnail URL (optional)</label><input className="input" value={wiz.thumbnail_url} onChange={e => setWiz({ ...wiz, thumbnail_url: e.target.value })} placeholder="https://… (image link)" /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={wiz.description} onChange={e => setWiz({ ...wiz, description: e.target.value })} placeholder="What does this test cover?" /></div>
              <div className="sm:col-span-2"><label className="label">Instructions for students</label><textarea className="input" rows={3} value={wiz.instructions} onChange={e => setWiz({ ...wiz, instructions: e.target.value })} placeholder="e.g. Answer all questions. No negative marking for unattempted questions." /></div>
              <div className="sm:col-span-2 flex justify-end"><button onClick={() => setWizStep(2)} className="btn-brand !py-2.5 text-sm">Next: Questions →</button></div>
            </div>}

            {wizStep === 2 && <div className="mt-4">
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Add questions">
                {(["manual", "bank", "import"] as const).map(t => <button key={t} role="tab" aria-selected={qTab === t} onClick={() => setQTab(t)} className={`app-press shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${qTab === t ? "bg-brand text-white" : "bg-slate-200"}`}>{t === "manual" ? "Write manually" : t === "bank" ? "From Question Bank" : "Bulk import (CSV / Excel / JSON)"}</button>)}
              </div>
              <div className="mt-3">
                {qTab === "manual" && qEditor(editingQ ? "Update question" : "Add question to test", saveQForm)}
                {qTab === "bank" && bankPicker()}
                {qTab === "import" && importPanel("wizard")}
              </div>
              <div className="mt-4">
                <p className="text-sm font-extrabold">Questions in this test ({wizQs.length}) · {totalMarksOf(wizQs)} marks</p>
                {wizQs.length === 0 && <p className="mt-2 text-sm text-slate-500">No questions yet — write one, pick from the bank, or import a file.</p>}
                <div className="mt-2 space-y-2">
                  {wizQs.map((q, i) => <div key={q.localId} className="rounded-2xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold">Q{i + 1}. {q.question_text}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold">{q.marks} marks</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{q.subject} {q.topic ? `· ${q.topic}` : ""} · {q.difficulty} · {Q_TYPE_LABEL[q.question_type]}{q.question_type !== "descriptive" ? ` · Correct: ${q.correct.join(", ")}` : ""}{q.saveToBank ? " · saved to bank" : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button onClick={() => editQ(q)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"><Pencil className="mr-1 inline h-3.5 w-3.5" />Edit</button>
                      <button onClick={() => dupQ(q)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">Duplicate</button>
                      <button onClick={() => moveQ(q.localId, -1)} disabled={i === 0} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">↑ Up</button>
                      <button onClick={() => moveQ(q.localId, 1)} disabled={i === wizQs.length - 1} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">↓ Down</button>
                      <button onClick={() => delQ(q.localId)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete</button>
                    </div>
                  </div>)}
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <button onClick={() => setWizStep(1)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">← Back</button>
                <button onClick={() => setWizStep(3)} disabled={!wizQs.length} className="btn-brand !py-2.5 text-sm disabled:opacity-40">Next: Settings →</button>
              </div>
            </div>}

            {wizStep === 3 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="label">Duration (minutes) *</label><input type="number" min="1" className="input" value={wiz.duration_minutes} onChange={e => setWiz({ ...wiz, duration_minutes: e.target.value })} /></div>
              <div><label className="label">Maximum attempts</label><input type="number" min="1" max="5" className="input" value={wiz.max_attempts} onChange={e => setWiz({ ...wiz, max_attempts: e.target.value })} /></div>
              <div><label className="label">Start date &amp; time (optional — leave empty to start on publish)</label><input type="datetime-local" className="input" value={wiz.start_at} onChange={e => setWiz({ ...wiz, start_at: e.target.value })} /></div>
              <div><label className="label">End date &amp; time (optional)</label><input type="datetime-local" className="input" value={wiz.end_at} onChange={e => setWiz({ ...wiz, end_at: e.target.value })} /></div>
              <div><label className="label">Show results</label><select className="input" value={wiz.show_results} onChange={e => setWiz({ ...wiz, show_results: e.target.value })}><option value="immediate">Immediately after submission</option><option value="after_publish">After teacher publishes results</option><option value="hidden">Hidden (score not shown)</option></select></div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={wiz.randomize_questions} onChange={e => setWiz({ ...wiz, randomize_questions: e.target.checked })} /> Randomize question order</label>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={wiz.randomize_options} onChange={e => setWiz({ ...wiz, randomize_options: e.target.checked })} /> Randomize answer options</label>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={wiz.allow_revisit} onChange={e => setWiz({ ...wiz, allow_revisit: e.target.checked })} /> Allow revisiting questions</label>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={wiz.show_answers} onChange={e => setWiz({ ...wiz, show_answers: e.target.checked })} /> Show correct answers in results</label>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={wiz.show_explanations} onChange={e => setWiz({ ...wiz, show_explanations: e.target.checked })} /> Show explanations in results</label>
              </div>
              <p className="text-xs text-slate-500 sm:col-span-2">The timer is enforced by the server — a student refreshing the page does not get extra time, and answers auto-submit when time expires.</p>
              <div className="flex justify-between sm:col-span-2">
                <button onClick={() => setWizStep(2)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">← Back</button>
                <button onClick={() => setWizStep(4)} className="btn-brand !py-2.5 text-sm">Next: Preview →</button>
              </div>
            </div>}

            {wizStep === 4 && <div className="mt-4">
              <div className="rounded-2xl border p-4">
                <h4 className="text-lg font-extrabold">{wiz.title || "(untitled test)"}</h4>
                <p className="mt-1 text-sm text-slate-600">{wiz.description || "No description."}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3"><b className="text-lg">{wizQs.length}</b><span className="block text-xs font-bold text-slate-500">Questions</span></div>
                  <div className="rounded-xl bg-slate-50 p-3"><b className="text-lg">{totalMarksOf(wizQs)}</b><span className="block text-xs font-bold text-slate-500">Total marks</span></div>
                  <div className="rounded-xl bg-slate-50 p-3"><b className="text-lg">{wiz.duration_minutes} min</b><span className="block text-xs font-bold text-slate-500">Duration</span></div>
                  <div className="rounded-xl bg-slate-50 p-3"><b className="text-lg">{batchName(wiz.batch_id)}</b><span className="block text-xs font-bold text-slate-500">Batch</span></div>
                </div>
                <p className="mt-3 text-sm text-slate-600">Category: <b>{wiz.category}</b> · Difficulty: <b>{wiz.difficulty}</b> · Attempts: <b>{wiz.max_attempts}</b> · Passing marks: <b>{wiz.passing_marks || "—"}</b> · Results: <b>{wiz.show_results === "immediate" ? "immediate" : wiz.show_results === "after_publish" ? "after teacher publishes" : "hidden"}</b></p>
                {wiz.start_at && <p className="text-sm text-slate-600">Starts: <b>{new Date(wiz.start_at).toLocaleString()}</b>{wiz.end_at ? <> · Ends: <b>{new Date(wiz.end_at).toLocaleString()}</b></> : ""}</p>}
                <div className="mt-3 space-y-2">
                  {wizQs.map((q, i) => <p key={q.localId} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><b>Q{i + 1}.</b> {q.question_text} <span className="text-slate-500">({q.marks} marks{ n(q, "negative_marks") > 0 ? `, −${n(q, "negative_marks")} negative` : ""})</span></p>)}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setWizStep(3)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">← Back</button>
                <button onClick={() => void saveWizard(false)} disabled={busy} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-40">Save as draft</button>
                <button onClick={() => void saveWizard(true)} disabled={busy} className="btn-brand !py-2.5 text-sm disabled:opacity-40">{busy ? "Saving…" : wiz.start_at && new Date(wiz.start_at) > new Date() ? "Schedule publication" : "Publish now"}</button>
              </div>
            </div>}
          </div>
        )}
        {tab === "create" && !wizOpen && (
          <div className="card mt-3 !p-5 text-center">
            <ListChecks className="mx-auto h-10 w-10 text-brand" />
            <h3 className="mt-2 font-extrabold">Build a test in minutes</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Add basic info, write or import questions, set timing and marking, then preview and publish to your batch.</p>
            <button onClick={startWizard} className="btn-brand mt-4 !py-2.5 text-sm">Start the wizard →</button>
          </div>
        )}

        {tab === "tests" && <div className="mt-4 space-y-2">
          {myTests.length === 0 && <div className="card text-sm text-slate-500">No tests yet — create one with the wizard, or use the quick form below.</div>}
          {myTests.map(t => {
            const tid = s(t, "id");
            const st = testStatus(t);
            const results = (data.test_results || []).filter(r => s(r, "test_id") === tid);
            const avg = results.length ? (results.reduce((a, r) => a + n(r, "marks"), 0) / results.length).toFixed(1) : "—";
            const hasAttempts = (attemptCounts[tid] || 0) > 0;
            return <div key={tid} className="card !p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <b className="text-sm">{s(t, "title")}</b>
                  <p className="mt-0.5 text-xs text-slate-500">{batchName(s(t, "batch_id"))} · {s(t, "subject")} {s(t, "topic") ? `· ${s(t, "topic")}` : ""} · {s(t, "category") || ""} · {testQCounts[tid] || 0} questions · Total {String(t.total_marks ?? "")} · {s(t, "duration_minutes") ? `${s(t, "duration_minutes")} min` : ""}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{s(t, "start_at") ? `Starts ${new Date(s(t, "start_at")).toLocaleString()} · ` : ""}{s(t, "end_at") ? `Ends ${new Date(s(t, "end_at")).toLocaleString()} · ` : ""}Attempts: {attemptCounts[tid] || 0} · Manual marks avg: {avg}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold capitalize ${statusPill(st)}`}>{st}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => { setResTestId(tid); setTab("results"); void loadTeacherResults(tid); }} className="app-press rounded-xl border px-3 py-2 text-xs font-bold"><Eye className="mr-1 inline h-3.5 w-3.5" />Results</button>
                {!hasAttempts && <button onClick={() => void startEdit(t)} className="app-press rounded-xl border px-3 py-2 text-xs font-bold"><Pencil className="mr-1 inline h-3.5 w-3.5" />Edit</button>}
                {s(t, "status") === "draft" && <button onClick={() => void setTestStatus(t, "published")} className="btn-brand !py-2 text-xs">Publish</button>}
                {s(t, "status") === "published" && <button onClick={() => void setTestStatus(t, "draft")} className="app-press rounded-xl border px-3 py-2 text-xs font-bold">Unpublish</button>}
                {s(t, "status") !== "archived" && <button onClick={() => void setTestStatus(t, "archived")} className="app-press rounded-xl border px-3 py-2 text-xs font-bold">Archive</button>}
                {!hasAttempts && s(t, "status") === "draft" && <button onClick={() => void deleteTest(t)} className="app-press rounded-xl border px-3 py-2 text-xs font-bold text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete</button>}
                {hasAttempts && <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">Locked — attempts exist</span>}
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold">Enter marks per student (offline / paper tests)</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <div><label className="label">Student</label><select className="input" value={mmStu[tid] || ""} onChange={e => setMmStu({ ...mmStu, [tid]: e.target.value })}><option value="">— pick —</option>{(role === "teacher" ? students.filter(x => teacherStudentIds.has(s(x, "id"))) : students).map(x => <option key={s(x, "id")} value={s(x, "id")}>{s(x, "full_name")}</option>)}</select></div>
                  <div><label className="label">Marks</label><input type="number" className="input" value={mmMarks[tid] || ""} onChange={e => setMmMarks({ ...mmMarks, [tid]: e.target.value })} /></div>
                  <div><label className="label">Remarks</label><input className="input" value={mmRem[tid] || ""} onChange={e => setMmRem({ ...mmRem, [tid]: e.target.value })} /></div>
                  <div className="flex items-end"><button onClick={() => void saveManualMarks(tid)} className="btn-brand !py-2.5 text-xs">Save marks</button></div>
                </div>
                <ul className="mt-2 space-y-1 text-sm">{results.length === 0 ? <li className="text-slate-500">No manual results entered yet.</li> : results.map(r => <li key={s(r, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"><span>{nameOf(s(r, "student_id"))} — <b>{String(r.marks ?? "—")} / {String(t.total_marks ?? "")}</b>{s(r, "remarks") ? ` · ${s(r, "remarks")}` : ""}</span>{Number(r.marks || 0) / Number(t.total_marks || 1) * 100 >= 40 && <button onClick={() => setCert({ student: nameOf(s(r, "student_id")), test: s(t, "title"), marks: Number(r.marks || 0), total: Number(t.total_marks || 0), date: s(t, "test_date") })} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold">🏆 Certificate</button>}</li>)}</ul>
              </div>
            </div>;
          })}
          <div className="card !p-4">
            <button onClick={() => setQuickCreate(!quickCreate)} className="flex w-full items-center justify-between text-sm font-extrabold">Quick create (simple test — old form) <ChevronDown className={`h-4 w-4 transition-transform ${quickCreate ? "rotate-180" : ""}`} /></button>
            {quickCreate && <form onSubmit={createRow} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><label className="label">Batch</label><select required className="input" value={form.batch_id || ""} onChange={e => setForm({ ...form, batch_id: e.target.value })}><option value="">— pick —</option>{staffBatches.map(b => <option key={s(b, "id")} value={s(b, "id")}>{s(b, "name")}</option>)}</select></div>
              <div><label className="label">Test title</label><input required className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="label">Subject</label><input className="input" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div><label className="label">Total marks</label><input type="number" className="input" value={form.total_marks || ""} onChange={e => setForm({ ...form, total_marks: e.target.value })} /></div>
              <div><label className="label">Test date</label><input type="date" className="input" value={form.test_date || ""} onChange={e => setForm({ ...form, test_date: e.target.value })} /></div>
              <div className="flex items-end"><button className="btn-brand !py-2.5 text-sm">Save test</button></div>
            </form>}
          </div>
        </div>}

        {tab === "bank" && <div className="mt-4 space-y-3">
          <div className="card !p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-extrabold">Question Bank</h3><p className="text-sm text-slate-600">Reusable questions. Add them to any test from the wizard — editing the bank never changes tests already created.</p></div>
              <button onClick={() => { setQForm(emptyQ()); setEditingQ(""); setBankEditing(""); setShowBankEditor(!showBankEditor); }} className="btn-brand !py-2.5 text-sm"><Plus className="mr-1 inline h-4 w-4" />{showBankEditor ? "Close editor" : "Add question"}</button>
            </div>
            {showBankEditor && <div className="mt-3">{qEditor(bankEditing ? "Update bank question" : "Save to bank", saveBankQ)}</div>}
            <div className="mt-3">{importPanel("bank")}</div>
          </div>
          <div className="card !p-4">
            {bankPicker()}
            <div className="mt-3 space-y-2">
              {bankFiltered.map(b => <div key={s(b, "id")} className="rounded-2xl border p-3">
                <p className="text-sm font-bold">{s(b, "question_text")}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s(b, "subject")} {s(b, "topic") ? `· ${s(b, "topic")}` : ""} · {s(b, "difficulty")} · {n(b, "marks")} marks · {s(b, "question_type") === "descriptive" ? "Descriptive · manually graded" : `Correct: ${((Array.isArray(b.correct_answers) ? b.correct_answers : []) as string[]).join(", ")}`}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => { const d = bankToDraft(b); setQForm(d); setBankEditing(s(b, "id")); setShowBankEditor(true); }} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"><Pencil className="mr-1 inline h-3.5 w-3.5" />Edit</button>
                  <button onClick={() => void deleteBankQuestion(s(b, "id"))} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Remove</button>
                </div>
              </div>)}
            </div>
          </div>
        </div>}

        {tab === "results" && <div className="mt-4 space-y-3">
          <div className="card !p-4">
            <label className="label">Pick a test to see results</label>
            <div className="flex flex-wrap gap-2">
              <select className="input !w-auto flex-1" value={resTestId} onChange={e => setResTestId(e.target.value)}><option value="">— pick a test —</option>{myTests.map(t => <option key={s(t, "id")} value={s(t, "id")}>{s(t, "title")} — {batchName(s(t, "batch_id"))}</option>)}</select>
              <button onClick={() => resTestId && void loadTeacherResults(resTestId)} disabled={!resTestId || resBusy} className="btn-brand !py-2.5 text-sm disabled:opacity-40">{resBusy ? "Loading…" : "Load results"}</button>
            </div>
          </div>
          {resData && (() => {
            const ag = (resData.aggregates as Row) || {};
            const atts = (resData.attempts as Row[]) || [];
            const qStats = (resData.question_stats as Row[]) || [];
            const test = myTests.find(t => s(t, "id") === resTestId);
            const enrolled = (data.enrollments || []).filter(e => s(e, "batch_id") === s(test, "batch_id")).map(e => s(e, "student_id"));
            const attemptedIds = new Set(atts.map(a => s(a, "student_id")));
            const notAttempted = enrolled.filter(id => !attemptedIds.has(id));
            return <div className="card !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold">{test ? s(test, "title") : "Results"}</h3>
                <div className="flex gap-2">
                  {test && s(test, "show_results") === "after_publish" && !test.results_published && <button onClick={() => void publishResults(test)} className="btn-brand !py-2 text-xs">Publish results to students</button>}
                  <button onClick={downloadResultsCsv} className="app-press rounded-xl border px-3 py-2 text-xs font-bold"><Download className="mr-1 inline h-3.5 w-3.5" />Download CSV</button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{String(ag.attempted ?? 0)} / {enrolled.length}</b><span className="block text-xs font-bold text-slate-500">Attempted / assigned</span></div>
                <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{String(ag.average ?? "—")}</b><span className="block text-xs font-bold text-slate-500">Average score</span></div>
                <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{String(ag.highest ?? "—")} / {String(ag.lowest ?? "—")}</b><span className="block text-xs font-bold text-slate-500">Highest / lowest</span></div>
                <div className="rounded-2xl bg-slate-50 p-3"><b className="text-lg">{String(ag.pass_percentage ?? "—")}%</b><span className="block text-xs font-bold text-slate-500">Pass percentage</span></div>
              </div>
              {notAttempted.length > 0 && <p className="mt-3 text-sm text-slate-600"><b>Not attempted ({notAttempted.length}):</b> {notAttempted.map(nameOf).join(", ")}</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead><tr className="text-xs uppercase tracking-wide text-slate-400"><th className="py-2">Student</th><th>Score</th><th>%</th><th>Time</th><th>Result</th><th>Grading</th><th>Submitted</th></tr></thead>
                  <tbody>{atts.length === 0 ? <tr><td colSpan={7} className="py-3 text-slate-500">No attempts yet.</td></tr> : atts.map(a => <tr key={s(a, "attempt_id")} className="border-t"><td className="py-2 font-bold">{nameOf(s(a, "student_id"))}</td><td>{String(a.score)} / {String(a.max_marks)}</td><td>{String(a.percentage)}%</td><td>{fmtClock(n(a, "time_taken_seconds"))}</td><td><span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${a.passed ? "bg-brand-tint text-brand-dark" : "bg-red-100 text-red-700"}`}>{a.passed ? "Pass" : "Fail"}</span></td><td>{a.manual_grading_pending ? <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">Needs grading</span> : <span className="mr-2 text-xs text-slate-400">—</span>}<button onClick={() => void loadGrading(resTestId, s(a, "attempt_id"))} className="rounded-lg border px-2 py-1 text-xs font-bold">Grade</button></td><td className="text-xs text-slate-500">{s(a, "submitted_at") ? new Date(s(a, "submitted_at")).toLocaleString() : "—"}</td></tr>)}</tbody>
                </table>
              </div>
              {gradingAttemptId && <div className="mt-5 rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-extrabold">Manual grading — {nameOf(s(gradingData, "student_id"))}{gradingData ? ` · Attempt ${String(gradingData.attempt_number)} · ${String(gradingData.score)} / ${String(gradingData.max_marks)} so far` : ""}</h4>
                  <button onClick={() => { setGradingAttemptId(""); setGradingData(null); }} className="app-press flex h-9 w-9 items-center justify-center rounded-xl border" aria-label="Close grading"><X className="h-5 w-5" /></button>
                </div>
                {gradeBusy && !gradingData && <p className="mt-2 text-sm font-bold text-brand-dark">Loading attempt…</p>}
                {gradingData && (() => {
                  const gAnswers = (gradingData.answers as Row[]) || [];
                  const answered = gAnswers.filter(a => s(a, "answer_text").trim() !== "");
                  if (!gAnswers.length) return <p className="mt-2 text-sm text-slate-500">This test has no descriptive questions.</p>;
                  if (!answered.length) return <p className="mt-2 text-sm text-slate-500">The student left every descriptive question blank — nothing to grade.</p>;
                  return <div className="mt-3 space-y-3">
                    {gradingData.manual_grading_pending === true && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This attempt is awaiting manual grading — its total is not final until every answer below has marks.</p>}
                    {answered.map((a, i) => {
                      const qid = s(a, "question_id");
                      const maxM = n(a, "marks") || 1;
                      const graded = a.manual_marks !== null && a.manual_marks !== undefined;
                      return <div key={qid} className="rounded-2xl border p-4">
                        <p className="text-sm font-bold">Q{i + 1}. {s(a, "question_text")} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold">{maxM} marks</span></p>
                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">{s(a, "answer_text")}</p>
                        {s(a, "model_answer") && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm"><b>Model answer / guidance:</b> {s(a, "model_answer")}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="text-sm font-bold">Marks (0–{maxM})</label>
                          <input type="number" min="0" max={maxM} step="0.5" className="input !w-24" value={gradeMarks[qid] ?? ""} onChange={e => setGradeMarks({ ...gradeMarks, [qid]: e.target.value })} placeholder="0" />
                          <button onClick={() => void saveGrade(qid, maxM)} disabled={gradeBusy} className="btn-brand !py-2 text-xs disabled:opacity-40">{gradeBusy ? "Saving…" : graded ? "Update grade" : "Save grade"}</button>
                          {graded && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-700">Graded: {String(a.manual_marks)} / {maxM}</span>}
                        </div>
                      </div>;
                    })}
                  </div>;
                })()}
              </div>}
              <h4 className="mt-5 font-extrabold">Question-wise accuracy</h4>
              <div className="mt-2 space-y-2">
                {qStats.map((q, i) => <div key={s(q, "question_id")}><p className="text-sm"><b>Q{i + 1}.</b> {s(q, "question_text")}</p>{s(q, "question_type") === "descriptive" ? <p className="mt-1 text-xs font-bold text-amber-800">Descriptive — manually graded · {String(q.attempted)} answer{String(q.attempted) === "1" ? "" : "s"} written</p> : <div className="mt-1 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand" style={{ width: `${n(q, "accuracy") || 0}%` }} /></div><span className="text-xs font-bold">{q.accuracy === null ? "—" : `${String(q.accuracy)}%`} ({String(q.correct)}/{String(q.attempted)} correct)</span></div>}</div>)}
              </div>
            </div>;
          })()}
        </div>}
      </div>
    );
  }

  // ---------- Student view ----------
  const listFor = stuTab === "available"
    ? studentTests.filter(x => !x.submitted && !x.upcoming)
    : stuTab === "upcoming"
    ? studentTests.filter(x => x.upcoming && !x.submitted)
    : stuTab === "completed"
    ? studentTests.filter(x => x.submitted)
    : [];
  const testCard = (x: (typeof studentTests)[number]) => {
    const t = x.t;
    const qCount = testQCounts[s(t, "id")] || 0;
    return (
      <div key={s(t, "id")} className="card !p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <b className="text-sm">{s(t, "title")}</b>
            <p className="mt-0.5 text-xs text-slate-500">{batchName(s(t, "batch_id"))} · {s(t, "subject")} {s(t, "topic") ? `· ${s(t, "topic")}` : ""} · {s(t, "category") || ""}</p>
            <p className="mt-0.5 text-xs text-slate-500">{qCount} questions · {n(t, "duration_minutes") || 60} min · {String(t.total_marks ?? "")} marks{s(t, "start_at") ? ` · Starts ${new Date(s(t, "start_at")).toLocaleString()}` : ""}{s(t, "end_at") ? ` · Ends ${new Date(s(t, "end_at")).toLocaleString()}` : ""}</p>
            <p className="mt-0.5 text-xs text-slate-500">Attempts used: {attemptCounts[s(t, "id")] || 0} / {n(t, "max_attempts") || 1}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${x.live ? "bg-emerald-100 text-emerald-700" : x.upcoming ? "bg-amber-100 text-amber-800" : x.submitted ? "bg-brand-tint text-brand-dark" : "bg-slate-200 text-slate-600"}`}>{x.submitted ? "Completed" : x.live ? "● Live now" : x.upcoming ? "Upcoming" : "Available"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {x.submitted && <button onClick={() => void loadMyResult(s(t, "id"))} disabled={resBusy} className="btn-brand !py-2 text-xs">View my result</button>}
          {x.inProgress && <button onClick={() => void startTest(t)} disabled={examBusy} className="btn-brand !py-2 text-xs"><Play className="mr-1 inline h-3.5 w-3.5" />Resume test</button>}
          {!x.submitted && !x.inProgress && !x.upcoming && <button onClick={() => setInstrTest(t)} className="btn-brand !py-2 text-xs">View instructions &amp; start</button>}
          {x.upcoming && <button onClick={() => setInstrTest(t)} className="app-press rounded-xl border px-3 py-2 text-xs font-bold">View details</button>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="card mt-3 !p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-extrabold">Tests</h3><p className="text-sm text-slate-600">Exams for your enrolled batches. Only published tests appear here.</p></div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Test lists">
          {(["available", "upcoming", "completed", "results"] as const).map(k => (
            <button key={k} role="tab" aria-selected={stuTab === k} onClick={() => setStuTab(k)} className={`app-press shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${stuTab === k ? "bg-brand text-white" : "bg-slate-200"}`}>
              {k === "available" ? `Available (${studentTests.filter(x => !x.submitted && !x.upcoming).length})` : k === "upcoming" ? `Upcoming (${studentTests.filter(x => x.upcoming && !x.submitted).length})` : k === "completed" ? `Completed (${studentTests.filter(x => x.submitted).length})` : "My Results"}
            </button>
          ))}
        </div>
        {localMsg && <p className="mt-2 text-sm font-semibold text-amber-800">{localMsg}</p>}
      </div>

      {stuTab !== "results" && <div className="mt-4 space-y-2">
        {listFor.length === 0 && <div className="card text-sm text-slate-500">{stuTab === "available" ? "No tests available right now — check Upcoming, or enrol in a batch to see its tests." : stuTab === "upcoming" ? "No upcoming tests scheduled." : "No completed tests yet."}</div>}
        {listFor.map(testCard)}
      </div>}

      {stuTab === "results" && <div className="mt-4 space-y-2">
        <div className="card !p-4">
          <h4 className="font-extrabold">Online test results</h4>
          {attempts.filter(a => s(a, "status") === "submitted" || s(a, "status") === "expired").length === 0 && <p className="mt-2 text-sm text-slate-500">No online tests submitted yet.</p>}
          <ul className="mt-2 space-y-2">
            {attempts.filter(a => s(a, "status") === "submitted" || s(a, "status") === "expired").map(a => {
              const t = tests.find(x => s(x, "id") === s(a, "test_id"));
              return <li key={s(a, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span><b>{t ? s(t, "title") : "Test"}</b> — {String(a.score ?? "—")} / {String(a.max_marks ?? "")} ({String(a.percentage ?? "—")}%) · {a.passed ? "Passed ✓" : "Failed"} · {fmtClock(n(a, "time_taken_seconds"))}{a.manual_grading_pending ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">Awaiting grading</span> : null}</span>
                <button onClick={() => void loadMyResult(s(a, "test_id"))} className="font-bold text-brand-dark underline">View details →</button>
              </li>;
            })}
          </ul>
        </div>
        <div className="card !p-4">
          <h4 className="font-extrabold">Marks entered by your teacher (paper / offline tests)</h4>
          {legacyResults.length === 0 && <p className="mt-2 text-sm text-slate-500">No teacher-entered results yet.</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {legacyResults.map(r => {
              const t = tests.find(x => s(x, "id") === s(r, "test_id"));
              return <li key={s(r, "id")} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span>{t ? s(t, "title") : "Test"} — <b>{String(r.marks ?? "—")} / {t ? String(t.total_marks ?? "") : ""}</b>{s(r, "remarks") ? ` · ${s(r, "remarks")}` : ""}</span>
                {t && Number(r.marks || 0) / Number(t.total_marks || 1) * 100 >= 40 && <button onClick={() => setCert({ student: s(profile, "full_name"), test: s(t, "title"), marks: Number(r.marks || 0), total: Number(t.total_marks || 0), date: s(t, "test_date") })} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold">🏆 Certificate</button>}
              </li>;
            })}
          </ul>
        </div>
      </div>}
    </div>
  );
}
