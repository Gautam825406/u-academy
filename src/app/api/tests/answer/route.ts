// POST /api/tests/answer { attempt_id, question_id, selected: string[] }
// Autosave for one answer. Validates ownership, in-progress status and the
// server deadline. Only the student's selection is stored — marks are never
// computed or accepted from the client.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, s, type Row } from "../lib";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const auth = await getAuth(supabase);
    if (!auth?.user || !auth.profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const studentId = s(auth.profile, "id");
    const { attempt_id, question_id, selected } = await request.json().catch(() => ({}));
    if (!attempt_id || !question_id || !Array.isArray(selected)) {
      return NextResponse.json({ error: "attempt_id, question_id and selected[] are required." }, { status: 400 });
    }
    const { data: attempt } = await supabase.from("test_attempts").select("*").eq("id", attempt_id).single();
    if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    const a = attempt as Row;
    if (s(a, "student_id") !== studentId) return NextResponse.json({ error: "This attempt is not yours." }, { status: 403 });
    if (s(a, "status") !== "in_progress") return NextResponse.json({ error: "This attempt is already closed." }, { status: 409 });
    if (s(a, "expires_at") && new Date() > new Date(s(a, "expires_at"))) {
      return NextResponse.json({ error: "Time expired — submit the attempt." }, { status: 410 });
    }
    // The question must belong to this attempt's test.
    const { data: q } = await supabase.from("test_questions").select("id,test_id").eq("id", question_id).single();
    if (!q || s(q, "test_id") !== s(a, "test_id")) return NextResponse.json({ error: "Question does not belong to this test." }, { status: 400 });
    const clean = [...new Set(selected.map(String))].slice(0, 10);
    const { error } = await supabase.from("student_answers").upsert(
      { attempt_id, question_id, selected: clean, answered_at: new Date().toISOString() },
      { onConflict: "attempt_id,question_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save the answer." }, { status: 500 });
  }
}
