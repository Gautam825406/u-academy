// POST /api/tests/submit { attempt_id }
// Final submission. Idempotent: resubmitting an already-submitted attempt
// returns the existing result instead of re-scoring. Scoring is done
// server-side from test_questions — the client never sends marks. If the
// server deadline has passed, the attempt is scored with whatever answers
// exist (auto-submit path) and marked expired-but-scored.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, scoreAttempt, s, n, type Row } from "../lib";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const auth = await getAuth(supabase);
    if (!auth?.user || !auth.profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const studentId = s(auth.profile, "id");
    const { attempt_id } = await request.json().catch(() => ({}));
    if (!attempt_id) return NextResponse.json({ error: "attempt_id is required." }, { status: 400 });

    const { data: attempt } = await supabase.from("test_attempts").select("*").eq("id", attempt_id).single();
    if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    const a = attempt as Row;
    if (s(a, "student_id") !== studentId) return NextResponse.json({ error: "This attempt is not yours." }, { status: 403 });
    if (s(a, "status") === "submitted" || s(a, "status") === "expired") {
      // Idempotent resubmission: return the already-computed result.
      return NextResponse.json({
        ok: true, already_submitted: true,
        result: {
          score: n(a, "score"), max_marks: n(a, "max_marks"),
          percentage: n(a, "percentage"), passed: a.passed === true,
          time_taken_seconds: n(a, "time_taken_seconds"),
          pending_manual: a.manual_grading_pending === true,
        },
      });
    }
    if (s(a, "status") !== "in_progress") return NextResponse.json({ error: "This attempt cannot be submitted." }, { status: 409 });

    const now = new Date();
    const expired = !!(s(a, "expires_at") && now > new Date(s(a, "expires_at")));
    const { data: questions } = await supabase.from("test_questions").select("*").eq("test_id", s(a, "test_id")).order("sort_order", { ascending: true });
    const qs = (questions as Row[]) || [];
    const { data: answers } = await supabase.from("student_answers").select("question_id,selected,answer_text").eq("attempt_id", attempt_id);
    const ansMap = new Map<string, string[]>();
    const textMap = new Map<string, string>();
    for (const r of (answers as Row[]) || []) {
      ansMap.set(s(r, "question_id"), (Array.isArray(r.selected) ? r.selected : []).map(String));
      textMap.set(s(r, "question_id"), s(r, "answer_text"));
    }
    // Descriptive answers score 0 automatically and flag the attempt as
    // awaiting manual grading; the score below is the auto-scored part only.
    const { score, maxMarks, correct, incorrect, unattempted, pendingManual, perQuestion } = scoreAttempt(qs, ansMap, textMap);
    const startedAt = s(a, "started_at") ? new Date(s(a, "started_at")) : now;
    const timeTaken = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
    const percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0;
    const { data: test } = await supabase.from("tests").select("passing_marks").eq("id", s(a, "test_id")).single();
    const passing = test ? n(test as Row, "passing_marks") : 0;
    const passed = passing > 0 ? score >= passing : percentage >= 40;
    const finalStatus = expired ? "expired" : "submitted";

    // Persist per-question correctness (used for teacher question-wise accuracy).
    for (const [qid, v] of perQuestion) {
      await supabase.from("student_answers").update({ is_correct: v.is_correct, marks_awarded: v.marks_awarded }).eq("attempt_id", attempt_id).eq("question_id", qid);
    }
    const { error } = await supabase.from("test_attempts").update({
      status: finalStatus, submitted_at: now.toISOString(),
      score, max_marks: maxMarks, percentage, passed, time_taken_seconds: timeTaken,
      manual_grading_pending: pendingManual > 0,
    }).eq("id", attempt_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      ok: true, expired,
      result: { score, max_marks: maxMarks, percentage, passed, time_taken_seconds: timeTaken, correct, incorrect, unattempted, pending_manual: pendingManual > 0, pending_manual_count: pendingManual },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not submit the test." }, { status: 500 });
  }
}
