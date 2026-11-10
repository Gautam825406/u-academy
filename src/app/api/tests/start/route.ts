// POST /api/tests/start { test_id }
// Starts (or resumes) a student's attempt. Enforces server-side: enrolment
// in the test's batch, published status, availability window, and attempt
// limits. Returns the attempt + questions WITHOUT correct answers or
// explanations. A resume returns the SAME question/option order the attempt
// started with, so a refresh never reshuffles a live exam.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, isEnrolled, shuffle, stripQuestion, orderQuestions, s, n, type Row } from "../lib";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const auth = await getAuth(supabase);
    if (!auth?.user || !auth.profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const role = s(auth.profile, "role");
    if (role !== "student") return NextResponse.json({ error: "Only students can take tests." }, { status: 403 });
    const studentId = s(auth.profile, "id");
    const { test_id } = await request.json().catch(() => ({}));
    if (!test_id) return NextResponse.json({ error: "test_id is required." }, { status: 400 });

    const { data: test } = await supabase.from("tests").select("*").eq("id", test_id).single();
    if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    const t = test as Row;
    const status = s(t, "status") || "draft";
    if (status === "draft" || status === "archived") return NextResponse.json({ error: "This test is not published yet." }, { status: 403 });
    const now = new Date();
    if (s(t, "start_at") && now < new Date(s(t, "start_at"))) return NextResponse.json({ error: "This test has not started yet." }, { status: 403 });
    if (s(t, "end_at") && now > new Date(s(t, "end_at"))) return NextResponse.json({ error: "This test has ended." }, { status: 403 });
    const batchId = s(t, "batch_id");
    if (batchId && !(await isEnrolled(supabase, studentId, batchId))) {
      return NextResponse.json({ error: "You are not enrolled in this test's batch." }, { status: 403 });
    }

    const { data: questions } = await supabase.from("test_questions").select("*").eq("test_id", test_id).order("sort_order", { ascending: true });
    const qs = (questions as Row[]) || [];
    if (!qs.length) return NextResponse.json({ error: "This test has no questions yet." }, { status: 400 });

    const maxAttempts = n(t, "max_attempts") || 1;
    const { data: existing } = await supabase.from("test_attempts").select("*").eq("test_id", test_id).eq("student_id", studentId).order("attempt_number", { ascending: false });
    const attempts = (existing as Row[]) || [];
    // Resume an in-progress attempt that has not expired yet.
    const live = attempts.find(a => s(a, "status") === "in_progress" && (!s(a, "expires_at") || now < new Date(s(a, "expires_at"))));
    if (live) {
      const qOrder = (Array.isArray(live.question_order) ? live.question_order : []) as string[];
      const oOrders = (live.option_orders as Record<string, string[]>) || {};
      const ordered = orderQuestions(qs, qOrder);
      const { data: saved } = await supabase.from("student_answers").select("question_id,selected,answer_text").eq("attempt_id", s(live, "id"));
      return NextResponse.json({
        attempt: { id: s(live, "id"), expires_at: s(live, "expires_at"), attempt_number: n(live, "attempt_number"), started_at: s(live, "started_at") },
        questions: ordered.map(q => stripQuestion(q, oOrders[s(q, "id")])),
        saved_answers: ((saved as Row[]) || []).map(a => ({ question_id: s(a, "question_id"), selected: (Array.isArray(a.selected) ? a.selected : []).map(String), answer_text: s(a, "answer_text") })),
        resumed: true,
      });
    }
    // Expired in-progress attempts are closed out (they still count as an attempt).
    for (const a of attempts.filter(x => s(x, "status") === "in_progress")) {
      await supabase.from("test_attempts").update({ status: "expired" }).eq("id", s(a, "id"));
    }
    if (attempts.length >= maxAttempts) {
      return NextResponse.json({ error: `Attempt limit reached (${maxAttempts} attempt${maxAttempts > 1 ? "s" : ""}).` }, { status: 403 });
    }

    const durationMin = n(t, "duration_minutes") || 60;
    const expiresAt = new Date(now.getTime() + durationMin * 60 * 1000).toISOString();
    const qOrder = s(t, "randomize_questions") === "true" || t.randomize_questions === true
      ? shuffle(qs.map(q => s(q, "id")))
      : qs.map(q => s(q, "id"));
    const oOrders: Record<string, string[]> = {};
    const randomizeOptions = s(t, "randomize_options") === "true" || t.randomize_options === true;
    for (const q of qs) {
      const labels = ((Array.isArray(q.options) ? q.options : []) as Row[]).map(o => String(o.label));
      oOrders[s(q, "id")] = randomizeOptions ? shuffle(labels) : labels;
    }
    const { data: created, error } = await supabase.from("test_attempts").insert({
      test_id, student_id: studentId, status: "in_progress",
      attempt_number: attempts.length + 1, expires_at: expiresAt,
      question_order: qOrder, option_orders: oOrders,
    }).select().single();
    if (error || !created) return NextResponse.json({ error: error?.message || "Could not start the attempt." }, { status: 400 });
    const ordered = orderQuestions(qs, qOrder);
    return NextResponse.json({
      attempt: { id: s(created, "id"), expires_at: expiresAt, attempt_number: attempts.length + 1, started_at: s(created, "started_at") },
      questions: ordered.map(q => stripQuestion(q, oOrders[s(q, "id")])),
      saved_answers: [],
      resumed: false,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start the test." }, { status: 500 });
  }
}
