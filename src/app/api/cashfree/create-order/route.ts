import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/cashfree/create-order  { batch_id, plan_id?, course_id? }
// plan_id: a batch_plans row — its price is charged and its duration
// decides the subscription validity. Free plans enrol directly.
// Creates a Cashfree PG order (api-version 2023-08-01) for a paid batch or
// course, records a `payments` row (status 'created'), and returns the
// payment_session_id / payment_link the student is redirected to.
// Free items (price 0) enrol directly — no Cashfree call.
// If Cashfree keys are not configured, returns 400 with an honest error
// instead of pretending a payment happened.
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const batchId = body.batch_id as string | undefined;
    const courseId = body.course_id as string | undefined;
    const planId = body.plan_id as string | undefined;
    let plan: Record<string, unknown> | null = null;
    let durationDays = 0;
    if (!batchId && !courseId) {
      return NextResponse.json({ error: "Pick a batch or a course first." }, { status: 400 });
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    let price = 0;
    let title = "";
    if (batchId) {
      const { data: batch } = await supabase.from("batches").select("*").eq("id", batchId).single();
      if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
      if (String(batch.status) === "closed") return NextResponse.json({ error: "This batch is closed for enrolment." }, { status: 400 });
      price = Number(batch.price || 0);
      title = String(batch.name || "Batch");
      if (planId) {
        const { data: pl } = await supabase.from("batch_plans").select("*").eq("id", planId).single();
        if (!pl || String(pl.batch_id) !== batchId) return NextResponse.json({ error: "That plan does not belong to this batch." }, { status: 400 });
        if (String(pl.is_active) === "false") return NextResponse.json({ error: "That plan is no longer available." }, { status: 400 });
        plan = pl as Record<string, unknown>;
        price = Number(pl.price || 0);
        durationDays = Number(pl.duration_days || 0);
        title = `${title} — ${String(pl.name || "Plan")}`;
      }
      if (batch.capacity) {
        const { count } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", batchId);
        if ((count || 0) >= Number(batch.capacity)) return NextResponse.json({ error: "This batch is full." }, { status: 400 });
      }
      // Renewal (audit #3): an enrolment row alone must not block a new
      // purchase — only an ACTIVE enrolment does. An expired/cancelled
      // enrolment may buy (renew) again; the upsert below renews it.
      const { data: already } = await supabase.from("enrollments").select("id,subscription_status,valid_until").eq("batch_id", batchId).eq("student_id", user.id).maybeSingle();
      if (already) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const stillActive = (String(already.subscription_status || "active") === "active") && (!already.valid_until || String(already.valid_until) >= todayStr);
        if (stillActive) return NextResponse.json({ error: "You are already enrolled in this batch." }, { status: 400 });
      }
    } else if (courseId) {
      const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
      price = Number(course.price || 0);
      title = String(course.title || "Course");
      const { data: already } = await supabase.from("course_enrollments").select("id").eq("course_id", courseId).eq("student_id", user.id).maybeSingle();
      if (already) return NextResponse.json({ error: "You are already enrolled in this course." }, { status: 400 });
    }

    // Free — enrol directly, no Cashfree involved. Also record the
    // subscription so access gating (valid_until) works for free plans.
    if (!price || price <= 0) {
      if (batchId) {
        const validUntil = durationDays ? new Date(Date.now() + durationDays * 86400000).toISOString().slice(0, 10) : null;
        const { error } = await supabase.from("enrollments").upsert({ batch_id: batchId, student_id: user.id, plan_id: planId || null, valid_until: validUntil, subscription_status: "active" }, { onConflict: "batch_id,student_id" });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        if (planId) {
          await supabase.from("subscriptions").insert({ student_id: user.id, batch_id: batchId, plan_id: planId, plan_name: String(plan?.name || "Plan"), amount_paid: 0, valid_from: new Date().toISOString().slice(0, 10), valid_until: validUntil, status: "active" });
        }
      } else if (courseId) {
        const { error } = await supabase.from("course_enrollments").insert({ course_id: courseId, student_id: user.id, price_paid: 0 });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ free: true, title });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secret = process.env.CASHFREE_SECRET_KEY;
    if (!appId || !secret) {
      return NextResponse.json(
        { error: "Cashfree is not configured yet — ask Admin to add the Cashfree keys in Vercel env vars." },
        { status: 400 }
      );
    }
    const isProd = process.env.CASHFREE_ENV === "PROD";
    const base = isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
    const origin = new URL(request.url).origin;
    const orderId = `U++-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": appId,
        "x-client-secret": secret,
        "x-api-version": "2023-08-01",
        "x-request-id": orderId,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: price,
        order_currency: "INR",
        customer_details: {
          customer_id: user.id,
          customer_email: profile?.email || user.email || "",
          customer_phone: String(profile?.mobile || "").replace(/\D/g, "").slice(-10) || "9999999999",
          customer_name: String(profile?.full_name || "Student"),
        },
        order_meta: { return_url: `${origin}/api/cashfree/return?order_id=${orderId}` },
        order_note: `U++ Academy — ${title}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.message || "Cashfree could not create the order. Please try again." }, { status: 400 });
    }

    const { error } = await supabase.from("payments").insert({
      student_id: user.id,
      batch_id: batchId || null,
      course_id: courseId || null,
      plan_id: planId || null,
      amount: price,
      currency: "INR",
      order_id: orderId,
      payment_session_id: data.payment_session_id || null,
      status: "created",
      payment_mode: "Cashfree",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      order_id: orderId,
      payment_session_id: data.payment_session_id || null,
      payment_link: data.payment_link || null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start the payment." }, { status: 500 });
  }
}
