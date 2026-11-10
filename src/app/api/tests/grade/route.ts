// POST /api/tests/grade { attempt_id, question_id, marks }
// Manual grading for one descriptive (essay) answer. Teacher only, and only
// for tests in their own batches (Admin may grade any test). Validates the
// attempt is submitted, the question is descriptive and belongs to the
// test, the student actually wrote an answer, and 0 <= marks <= question
// marks. On save it stores manual_marks (+ graded_by / graded_at), mirrors
// the mark into marks_awarded, then recomputes the attempt total from all
// stored answers (auto MCQ marks + manual descriptive marks), percentage
// and pass/fail, and clears manual_grading_pending once every descriptive
// answer in the attempt has a manual mark. Re-grading (changing an earlier
// mark) is allowed and recomputes the same way.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, totalsFromAnswers, s, n, type Row } from "../lib";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const auth = await getAuth(supabase);
    if (!auth?.user || !auth.profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const role = s(auth.profile, "role");
    if (role !== "admin" && role !== "teacher") return NextResponse.json({ error: "Only teachers can grade answers." }, { status: 403 });
    const { attempt_id, question_id, marks } = await request.json().catch(() => ({}));
    if (!attempt_id || !question_id || marks === undefined || marks === null || marks === "") {
      return NextResponse.json({ error: "attempt_id, question_id and marks are required." }, { status: 400 });
    }
    const marksNum = Number(marks);
    if (!Number.isFinite(marksNum) || marksNum < 0) {
      return NextResponse.json({ error: "Marks must be a number, 0 or more." }, { status: 400 });
    }

    const { data: attempt } = await supabase.from("test_attempts").select("*").eq("id", attempt_id).single();
    if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    const a = attempt as Row;
    if (s(a, "status") !== "submitted" && s(a, "status") !== "expired") {
      return NextResponse.json({ error: "This attempt has not been submitted yet — it cannot be graded." }, { status: 409 });
    }
    const { data: test } = await supabase.from("tests").select("*").eq("id", s(a, "test_id")).single();
    if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    const t = test as Row;
    // Teachers grade only their own batches; Admin may grade any test.
    if (role === "teacher" && s(t, "batch_id")) {
      const { data: b } = await supabase.from("batches").select("teacher_id").eq("id", s(t, "batch_id")).single();
      if (!b || s(b as Row, "teacher_id") !== s(auth.profile, "id")) {
        return NextResponse.json({ error: "This test is not in your batch." }, { status: 403 });
      }
    }
    const { data: question } = await supabase.from("test_questions").select("*").eq("id", question_id).single();
    if (!question || s(question as Row, "test_id") !== s(a, "test_id")) {
      return NextResponse.json({ error: "Question does not belong to this test." }, { status: 400 });
    }
    const q = question as Row;
    if (s(q, "question_type") !== "descriptive") {
      return NextResponse.json({ error: "Only descriptive questions are manually graded — MCQ questions are auto-scored." }, { status: 400 });
    }
    const qMarks = n(q, "marks") || 1;
    if (marksNum > qMarks) {
      return NextResponse.json({ error: `Marks cannot exceed ${qMarks} for this question.` }, { status: 400 });
    }
    const { data: answer } = await supabase.from("student_answers").select("*").eq("attempt_id", attempt_id).eq("question_id", question_id).single();
    if (!answer || s(answer as Row, "answer_text").trim() === "") {
      return NextResponse.json({ error: "The student did not write an answer for this question." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase.from("student_answers").update({
      manual_marks: marksNum, marks_awarded: marksNum,
      graded_by: s(auth.profile, "id"), graded_at: now,
    }).eq("attempt_id", attempt_id).eq("question_id", question_id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    // Recompute the attempt totals from all stored answers.
    const { data: questions } = await supabase.from("test_questions").select("*").eq("test_id", s(a, "test_id")).order("sort_order", { ascending: true });
    const { data: answers } = await supabase.from("student_answers").select("*").eq("attempt_id", attempt_id);
    const { score, maxMarks, autoScore, manualScore, pendingManual } = totalsFromAnswers((questions as Row[]) || [], (answers as Row[]) || []);
    const percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0;
    const passing = n(t, "passing_marks");
    const passed = passing > 0 ? score >= passing : percentage >= 40;
    const { error: attErr } = await supabase.from("test_attempts").update({
      score, max_marks: maxMarks, percentage, passed,
      manual_grading_pending: pendingManual > 0,
    }).eq("id", attempt_id);
    if (attErr) return NextResponse.json({ error: attErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      attempt: {
        attempt_id, score, max_marks: maxMarks, percentage, passed,
        auto_score: autoScore, manual_score: manualScore,
        pending_manual: pendingManual > 0, pending_manual_count: pendingManual,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save the grade." }, { status: 500 });
  }
}
