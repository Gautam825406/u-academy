// Shared helpers for the Test & Assessment API routes.
// SECURITY: all enrolment, attempt-limit, deadline and scoring checks live
// here, server-side. The student client never receives correct answers or
// explanations before the test's result-release settings allow it, and the
// client-side timer is display-only — the server's expires_at decides.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
export const s = (r: Row | null | undefined, k: string) => String((r as Row)?.[k] ?? "");
export const n = (r: Row | null | undefined, k: string) => Number((r as Row)?.[k] ?? 0) || 0;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sameSet(a: string[], b: string[]) {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

// The authenticated user + their profile row (role, child link for parents).
export async function getAuth(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile: (profile as Row | null) || null };
}

// Mirror of the dashboard's activeBatchIds logic: an ACTIVE subscription
// (not cancelled, valid_until >= today) OR an active enrolment (legacy
// enrolments with no valid_until are grandfathered as active).
export async function isEnrolled(supabase: SupabaseClient, studentId: string, batchId: string) {
  if (!studentId || !batchId) return false;
  const today = new Date().toISOString().slice(0, 10);
  const { data: subs } = await supabase.from("subscriptions").select("status,valid_until").eq("student_id", studentId).eq("batch_id", batchId);
  for (const x of (subs as Row[]) || []) {
    if (s(x, "status") === "cancelled") continue;
    const vu = s(x, "valid_until");
    if (!vu || vu >= today) return true;
  }
  const { data: enr } = await supabase.from("enrollments").select("subscription_status,valid_until").eq("student_id", studentId).eq("batch_id", batchId);
  for (const e of (enr as Row[]) || []) {
    if ((s(e, "subscription_status") || "active") !== "active") continue;
    const vu = s(e, "valid_until");
    if (!vu || vu >= today) return true;
  }
  return false;
}

// Client-safe question: never correct_answers, never explanation.
export function stripQuestion(q: Row, optionOrder?: string[]) {
  const opts = (Array.isArray(q.options) ? (q.options as Row[]) : []) as Row[];
  const ordered = optionOrder && optionOrder.length === opts.length
    ? optionOrder.map(l => opts.find(o => String(o.label) === l)).filter(Boolean) as Row[]
    : opts;
  return {
    id: s(q, "id"),
    question_text: s(q, "question_text"),
    question_type: s(q, "question_type") || "single",
    options: ordered.map(o => ({ label: String(o.label), text: String(o.text ?? "") })),
    marks: n(q, "marks") || 1,
    negative_marks: n(q, "negative_marks") || 0,
    difficulty: s(q, "difficulty") || "Medium",
    subject: s(q, "subject"),
    topic: s(q, "topic"),
  };
}

export function orderQuestions(questions: Row[], questionOrder: string[]) {
  if (!questionOrder?.length) return [...questions].sort((a, b) => n(a, "sort_order") - n(b, "sort_order"));
  const byId = new Map(questions.map(q => [s(q, "id"), q]));
  const ordered = questionOrder.map(id => byId.get(id)).filter(Boolean) as Row[];
  const rest = questions.filter(q => !questionOrder.includes(s(q, "id")));
  return [...ordered, ...rest];
}

// Server-side scoring. single: exactly the one correct label. multiple:
// the selected set must equal the correct set (all correct, no wrong).
// Correct -> +marks, answered-wrong -> -negative_marks, unanswered -> 0.
// Descriptive (essay) questions are NEVER auto-scored: a non-empty typed
// answer scores 0 for now and is flagged pending_manual, so the attempt
// total is explicitly provisional until a teacher grades it via
// POST /api/tests/grade. Total is clamped at 0 (a test score never goes
// negative). `texts` maps question_id -> typed descriptive answer.
export function scoreAttempt(questions: Row[], answers: Map<string, string[]>, texts?: Map<string, string>) {
  let score = 0;
  let maxMarks = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let pendingManual = 0;
  const perQuestion = new Map<string, { is_correct: boolean | null; marks_awarded: number; pending_manual: boolean }>();
  for (const q of questions) {
    const marks = n(q, "marks") || 1;
    const neg = n(q, "negative_marks") || 0;
    maxMarks += marks;
    const qid = s(q, "id");
    if (s(q, "question_type") === "descriptive") {
      const text = (texts?.get(qid) || "").trim();
      if (!text) {
        unattempted++;
        perQuestion.set(qid, { is_correct: null, marks_awarded: 0, pending_manual: false });
      } else {
        pendingManual++;
        perQuestion.set(qid, { is_correct: null, marks_awarded: 0, pending_manual: true });
      }
      continue;
    }
    const correctAns = (Array.isArray(q.correct_answers) ? q.correct_answers : []).map(String);
    const sel = answers.get(qid) || [];
    if (!sel.length) {
      unattempted++;
      perQuestion.set(qid, { is_correct: false, marks_awarded: 0, pending_manual: false });
      continue;
    }
    const ok = sameSet(sel, correctAns);
    if (ok) {
      correct++;
      score += marks;
      perQuestion.set(qid, { is_correct: true, marks_awarded: marks, pending_manual: false });
    } else {
      incorrect++;
      score -= neg;
      perQuestion.set(qid, { is_correct: false, marks_awarded: -neg, pending_manual: false });
    }
  }
  if (score < 0) score = 0;
  return { score, maxMarks, correct, incorrect, unattempted, pendingManual, perQuestion };
}

// Recompute an attempt's totals from its stored answers (used after manual
// grading). MCQ marks come from student_answers.marks_awarded (set at
// submit, negative marks included); descriptive marks come from
// student_answers.manual_marks (null = not yet graded, contributes 0).
// Returns the auto/manual breakdown plus whether any descriptive answer is
// still awaiting a grade. Total is clamped at 0 like scoreAttempt.
export function totalsFromAnswers(questions: Row[], answers: Row[]) {
  const byQ = new Map(answers.map(a => [s(a, "question_id"), a]));
  let maxMarks = 0;
  let autoScore = 0;
  let manualScore = 0;
  let pendingManual = 0;
  for (const q of questions) {
    const marks = n(q, "marks") || 1;
    maxMarks += marks;
    const a = byQ.get(s(q, "id"));
    if (!a) continue;
    if (s(q, "question_type") === "descriptive") {
      const text = s(a, "answer_text").trim();
      if (text && a.manual_marks !== null && a.manual_marks !== undefined && a.manual_marks !== "") {
        manualScore += Number(a.manual_marks) || 0;
      } else if (text) {
        pendingManual++;
      }
    } else {
      autoScore += n(a, "marks_awarded");
    }
  }
  const score = Math.max(0, autoScore + manualScore);
  return { score, maxMarks, autoScore, manualScore, pendingManual };
}
