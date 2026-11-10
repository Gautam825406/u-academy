// GET /api/tests/results?test_id=...
// Students see ONLY their own attempt, and question-wise correct answers /
// explanations only when the test's release settings allow it (immediate,
// or after_publish once the teacher published results). Teachers see only
// tests in their own batches; Admin sees all. Correct answers are never
// returned when the test hides them.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, s, n, type Row } from "../lib";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const auth = await getAuth(supabase);
    if (!auth?.user || !auth.profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const role = s(auth.profile, "role");
    const testId = new URL(request.url).searchParams.get("test_id");
    if (!testId) return NextResponse.json({ error: "test_id is required." }, { status: 400 });
    const { data: test } = await supabase.from("tests").select("*").eq("id", testId).single();
    if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    const t = test as Row;

    const isStaff = role === "admin" || role === "teacher";
    if (role === "teacher" && s(t, "batch_id")) {
      const { data: b } = await supabase.from("batches").select("teacher_id").eq("id", s(t, "batch_id")).single();
      if (!b || s(b as Row, "teacher_id") !== s(auth.profile, "id")) {
        return NextResponse.json({ error: "This test is not in your batch." }, { status: 403 });
      }
    }
    const viewerId = role === "parent" && s(auth.profile, "child_student_id")
      ? s(auth.profile, "child_student_id")
      : s(auth.profile, "id");

    const { data: attempts } = await supabase.from("test_attempts").select("*").eq("test_id", testId).order("submitted_at", { ascending: false });
    const all = (attempts as Row[]) || [];
    const mine = all.filter(a => s(a, "student_id") === viewerId && (s(a, "status") === "submitted" || s(a, "status") === "expired"));
    const myLatest = mine[0] || null;

    // Release rules (students only; staff always see everything).
    const showResults = s(t, "show_results") || "immediate";
    const released = isStaff || showResults === "immediate" || (showResults === "after_publish" && t.results_published === true);
    const showAnswers = released && (t.show_answers !== false);
    const showExplanations = released && (t.show_explanations !== false);

    const { data: questions } = await supabase.from("test_questions").select("*").eq("test_id", testId).order("sort_order", { ascending: true });
    const qs = (questions as Row[]) || [];

    if (!isStaff) {
      if (!myLatest) return NextResponse.json({ released, has_attempt: false, result: null, review: [] });
      const { data: answers } = await supabase.from("student_answers").select("*").eq("attempt_id", s(myLatest, "id"));
      const ansMap = new Map(((answers as Row[]) || []).map(a => [s(a, "question_id"), a]));
      const review = qs.map(q => {
        const a = ansMap.get(s(q, "id"));
        const selected = a ? (Array.isArray(a.selected) ? a.selected : []).map(String) : [];
        return {
          question_id: s(q, "id"), question_text: s(q, "question_text"),
          options: (Array.isArray(q.options) ? q.options : []).map((o: Row) => ({ label: String(o.label), text: String(o.text ?? "") })),
          selected, marks: n(q, "marks") || 1,
          is_correct: a ? a.is_correct === true : false,
          marks_awarded: a ? n(a, "marks_awarded") : 0,
          correct_answers: showAnswers ? (Array.isArray(q.correct_answers) ? q.correct_answers : []).map(String) : undefined,
          explanation: showExplanations ? s(q, "explanation") : undefined,
        };
      });
      return NextResponse.json({
        released,
        has_attempt: true,
        result: released ? {
          score: n(myLatest, "score"), max_marks: n(myLatest, "max_marks"),
          percentage: n(myLatest, "percentage"), passed: myLatest.passed === true,
          time_taken_seconds: n(myLatest, "time_taken_seconds"),
          submitted_at: s(myLatest, "submitted_at"), attempt_number: n(myLatest, "attempt_number"),
        } : { submitted_at: s(myLatest, "submitted_at"), attempt_number: n(myLatest, "attempt_number") },
        review: released ? review : review.map(r => ({ ...r, correct_answers: undefined, explanation: undefined })),
      });
    }

    // Staff: all attempts + aggregates + question-wise accuracy.
    const submitted = all.filter(a => s(a, "status") === "submitted" || s(a, "status") === "expired");
    const scores = submitted.map(a => n(a, "score"));
    const { data: allAnswers } = await supabase.from("student_answers").select("question_id,is_correct,attempt_id").in("attempt_id", submitted.map(a => s(a, "id")).slice(0, 500));
    const qStats = qs.map(q => {
      const rows = ((allAnswers as Row[]) || []).filter(a => s(a, "question_id") === s(q, "id"));
      const correctCount = rows.filter(a => a.is_correct === true).length;
      return {
        question_id: s(q, "id"), question_text: s(q, "question_text"),
        attempted: rows.length, correct: correctCount,
        accuracy: rows.length ? Math.round((correctCount / rows.length) * 100) : null,
      };
    });
    return NextResponse.json({
      released: true,
      test: { id: s(t, "id"), title: s(t, "title"), batch_id: s(t, "batch_id"), total_marks: n(t, "total_marks") },
      aggregates: {
        assigned: 0, attempted: submitted.length,
        average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
        highest: scores.length ? Math.max(...scores) : null,
        lowest: scores.length ? Math.min(...scores) : null,
        pass_count: submitted.filter(a => a.passed === true).length,
        pass_percentage: submitted.length ? Math.round((submitted.filter(a => a.passed === true).length / submitted.length) * 100) : null,
      },
      attempts: submitted.map(a => ({
        attempt_id: s(a, "id"), student_id: s(a, "student_id"), attempt_number: n(a, "attempt_number"),
        score: n(a, "score"), max_marks: n(a, "max_marks"), percentage: n(a, "percentage"),
        passed: a.passed === true, time_taken_seconds: n(a, "time_taken_seconds"),
        submitted_at: s(a, "submitted_at"), status: s(a, "status"),
      })),
      question_stats: qStats,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load results." }, { status: 500 });
  }
}
