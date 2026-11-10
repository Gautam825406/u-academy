// GET /api/tests/results?test_id=...
// Students see ONLY their own attempt, and question-wise correct answers /
// explanations only when the test's release settings allow it (immediate,
// or after_publish once the teacher published results). Teachers see only
// tests in their own batches; Admin sees all. Correct answers are never
// returned when the test hides them.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, totalsFromAnswers, s, n, type Row } from "../lib";

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
      const breakdown = totalsFromAnswers(qs, (answers as Row[]) || []);
      const review = qs.map(q => {
        const a = ansMap.get(s(q, "id"));
        const selected = a ? (Array.isArray(a.selected) ? a.selected : []).map(String) : [];
        const isDescriptive = s(q, "question_type") === "descriptive";
        const answerText = a ? s(a, "answer_text") : "";
        const graded = a && a.manual_marks !== null && a.manual_marks !== undefined && a.manual_marks !== "";
        // A descriptive answer is "awaiting grading" while it has typed text
        // and no manual mark yet; it must never be shown as 0 marks.
        const pendingManual = isDescriptive && answerText.trim() !== "" && !graded;
        return {
          question_id: s(q, "id"), question_text: s(q, "question_text"),
          question_type: s(q, "question_type") || "single",
          options: (Array.isArray(q.options) ? q.options : []).map((o: Row) => ({ label: String(o.label), text: String(o.text ?? "") })),
          selected, marks: n(q, "marks") || 1,
          is_correct: a ? a.is_correct === true : false,
          marks_awarded: a ? n(a, "marks_awarded") : 0,
          answer_text: isDescriptive ? answerText : undefined,
          manual_marks: isDescriptive && graded ? Number(a.manual_marks) : null,
          pending_manual: pendingManual,
          correct_answers: showAnswers && !isDescriptive ? (Array.isArray(q.correct_answers) ? q.correct_answers : []).map(String) : undefined,
          // The explanation column holds the model answer / grading guidance
          // for descriptive questions: it is only revealed once the answer
          // has been graded (and only if the test shows explanations).
          explanation: showExplanations && (!isDescriptive || graded) ? s(q, "explanation") : undefined,
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
          auto_score: breakdown.autoScore, manual_score: breakdown.manualScore,
          pending_manual: myLatest.manual_grading_pending === true,
        } : { submitted_at: s(myLatest, "submitted_at"), attempt_number: n(myLatest, "attempt_number"), pending_manual: myLatest.manual_grading_pending === true },
        review: released ? review : review.map(r => ({ ...r, correct_answers: undefined, explanation: undefined })),
      });
    }

    // Staff: all attempts + aggregates + question-wise accuracy.
    const submitted = all.filter(a => s(a, "status") === "submitted" || s(a, "status") === "expired");
    const scores = submitted.map(a => n(a, "score"));
    const { data: allAnswers } = await supabase.from("student_answers").select("question_id,is_correct,attempt_id").in("attempt_id", submitted.map(a => s(a, "id")).slice(0, 500));
    const qStats = qs.map(q => {
      const rows = ((allAnswers as Row[]) || []).filter(a => s(a, "question_id") === s(q, "id"));
      const isDescriptive = s(q, "question_type") === "descriptive";
      // Descriptive questions have no auto right/wrong — accuracy is meaningless.
      const correctCount = isDescriptive ? 0 : rows.filter(a => a.is_correct === true).length;
      return {
        question_id: s(q, "id"), question_text: s(q, "question_text"),
        question_type: s(q, "question_type") || "single",
        attempted: rows.length, correct: correctCount,
        accuracy: isDescriptive || !rows.length ? null : Math.round((correctCount / rows.length) * 100),
      };
    });

    // Staff grading detail: ?attempt_id=… returns one attempt's descriptive
    // answers (student text + model answer/guidance) for manual grading.
    const gradeAttemptId = new URL(request.url).searchParams.get("attempt_id");
    let grading: Row | null = null;
    if (gradeAttemptId) {
      const att = submitted.find(a => s(a, "id") === gradeAttemptId) || null;
      if (att) {
        const { data: gAnswers } = await supabase.from("student_answers").select("*").eq("attempt_id", gradeAttemptId);
        const gMap = new Map(((gAnswers as Row[]) || []).map(a => [s(a, "question_id"), a]));
        grading = {
          attempt_id: s(att, "id"), student_id: s(att, "student_id"),
          attempt_number: n(att, "attempt_number"), submitted_at: s(att, "submitted_at"),
          score: n(att, "score"), max_marks: n(att, "max_marks"),
          manual_grading_pending: att.manual_grading_pending === true,
          answers: qs.filter(q => s(q, "question_type") === "descriptive").map(q => {
            const a = gMap.get(s(q, "id"));
            const graded = !!a && a.manual_marks !== null && a.manual_marks !== undefined && a.manual_marks !== "";
            return {
              question_id: s(q, "id"), question_text: s(q, "question_text"),
              marks: n(q, "marks") || 1,
              // Model answer / grading guidance (teacher-only column).
              model_answer: s(q, "explanation"),
              answer_text: a ? s(a, "answer_text") : "",
              manual_marks: graded ? Number(a.manual_marks) : null,
              graded_by: a ? s(a, "graded_by") : "",
              graded_at: a ? s(a, "graded_at") : "",
            };
          }),
        };
      }
    }

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
        manual_grading_pending: a.manual_grading_pending === true,
      })),
      question_stats: qStats,
      ...(grading ? { grading } : {}),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load results." }, { status: 500 });
  }
}
