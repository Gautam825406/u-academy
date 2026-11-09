import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// POST /api/cashfree/webhook
// Cashfree PG server-to-server webhook. Cashfree signs every webhook with
// HMAC-SHA256 over (timestamp + raw body) using the merchant secret key,
// base64-encoded, sent as `x-webhook-signature`, with the timestamp in
// `x-webhook-timestamp`. See:
// https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
//   expectedSignature = Base64Encode(HMAC-SHA256(timestamp + rawBody, secret))
// The signature is over the RAW body — never parse before verifying.
// Timestamps older than 5 minutes are rejected (replay protection).
// On a verified PAYMENT_SUCCESS_WEBHOOK we mark the payment paid and enrol
// exactly like the return route does; the webhook is idempotent, so a
// duplicate delivery (or a return-route visit for the same order) never
// creates a second enrolment, subscription or fee receipt.
// Configure the notify URL in the Cashfree dashboard as
//   https://<your-domain>/api/cashfree/webhook
// NOTE: this is a server-to-server call with NO user session/cookies, so
// the anon-key client would arrive as role 'anon' — and every RLS policy in
// this project requires auth.role() = 'authenticated'. The webhook therefore
// uses the service-role key (bypasses RLS) when SUPABASE_SERVICE_ROLE_KEY is
// set, and falls back to the anon client with a warning otherwise.

export const dynamic = "force-dynamic";

const MAX_AGE_SECONDS = 300; // 5 minutes

// Service-role client for webhook writes (no user session exists here).
// Falls back to the anon-key cookie client when no service key is set —
// in that case RLS will block the enrolment writes (see warning below).
function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && url) {
    return createServiceClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  console.warn(
    "[cashfree webhook] SUPABASE_SERVICE_ROLE_KEY is not set — webhook enrolment writes will be blocked by RLS until it is added in Vercel."
  );
  return createClient();
}

function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isFreshTimestamp(timestamp: string): boolean {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return false;
  // Cashfree sends the timestamp as epoch seconds; tolerate milliseconds too.
  const seconds = n > 9999999999 ? Math.floor(n / 1000) : n;
  const age = Math.floor(Date.now() / 1000) - seconds;
  return age >= -60 && age <= MAX_AGE_SECONDS;
}

export async function POST(request: NextRequest) {
  const secret = (process.env.CASHFREE_SECRET_KEY || "").trim();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (!secret || !signature || !timestamp) {
    return NextResponse.json({ ok: false, error: "Missing signature, timestamp or server secret." }, { status: 401 });
  }
  if (!isFreshTimestamp(timestamp)) {
    return NextResponse.json({ ok: false, error: "Stale webhook timestamp." }, { status: 401 });
  }

  // Raw body first — parsing before verifying would break the signature.
  const rawBody = await request.text();
  if (!verifySignature(rawBody, timestamp, signature, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const eventType = String(payload.type || "");
  const data = (payload.data || {}) as Record<string, unknown>;
  const order = (data.order || {}) as Record<string, unknown>;
  const paymentInfo = (data.payment || {}) as Record<string, unknown>;
  const orderId = String(order.order_id || "");
  if (!orderId) {
    // Nothing to reconcile — acknowledge so Cashfree stops retrying.
    return NextResponse.json({ ok: true });
  }
  const cfPaymentId = paymentInfo.cf_payment_id ? String(paymentInfo.cf_payment_id) : null;

  const supabase = getSupabase();

  // Idempotency: load the payments row first. If it is already paid, a
  // duplicate webhook (or the return route) must not re-enrol / re-charge.
  const { data: payment } = await supabase.from("payments").select("*").eq("order_id", orderId).single();
  if (!payment) {
    // Unknown order — acknowledge; do not invent an enrolment.
    return NextResponse.json({ ok: true });
  }
  const alreadyPaid = payment.status === "paid" || payment.status === "successful";

  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    if (alreadyPaid) return NextResponse.json({ ok: true });
    const { error } = await supabase
      .from("payments")
      .update({ status: "paid", cf_payment_id: cfPaymentId })
      .eq("order_id", orderId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const studentId = String(payment.student_id);
    const batchId = payment.batch_id ? String(payment.batch_id) : null;
    const courseId = payment.course_id ? String(payment.course_id) : null;
    const amount = Number(payment.amount || 0);
    const planId = payment.plan_id ? String(payment.plan_id) : null;
    let validUntil: string | null = null;
    let planName = "";
    if (planId) {
      const { data: pl } = await supabase.from("batch_plans").select("*").eq("id", planId).single();
      if (pl) {
        planName = String(pl.name || "Plan");
        const days = Number(pl.duration_days || 0);
        if (days) validUntil = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      }
    }

    if (batchId) {
      await supabase.from("enrollments").upsert(
        { batch_id: batchId, student_id: studentId, plan_id: planId, valid_until: validUntil, subscription_status: "active" },
        { onConflict: "batch_id,student_id" }
      );
      // One subscription per order — skip if the return route already made it.
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!existingSub) {
        await supabase.from("subscriptions").insert({
          student_id: studentId,
          batch_id: batchId,
          plan_id: planId,
          plan_name: planName || null,
          amount_paid: amount,
          valid_from: new Date().toISOString().slice(0, 10),
          valid_until: validUntil,
          status: "active",
          order_id: orderId,
        });
      }
    }
    if (courseId) {
      await supabase.from("course_enrollments").upsert(
        { course_id: courseId, student_id: studentId, price_paid: amount },
        { onConflict: "course_id,student_id" }
      );
    }
    // One fee receipt per order — same receipt format as the return route.
    const receipt = `U++-CF-${orderId.replace(/^U(?:\+\+|AA)-/, "").slice(0, 12)}`;
    const { data: existingFee } = await supabase
      .from("fees")
      .select("id")
      .eq("receipt_no", receipt)
      .maybeSingle();
    if (!existingFee) {
      await supabase.from("fees").insert({
        student_id: studentId,
        batch_id: batchId,
        amount,
        status: "paid",
        receipt_no: receipt,
        due_month: new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }),
        paid_at: new Date().toISOString(),
        payment_mode: "Cashfree",
        created_by: studentId,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (
    eventType === "PAYMENT_FAILED_WEBHOOK" ||
    eventType === "PAYMENT_USER_DROPPED_WEBHOOK"
  ) {
    // Never overwrite a paid row — a late failure notice must not un-pay.
    if (alreadyPaid) return NextResponse.json({ ok: true });
    await supabase.from("payments").update({ status: "failed", cf_payment_id: cfPaymentId }).eq("order_id", orderId);
    return NextResponse.json({ ok: true });
  }

  // Other event types (e.g. refunds, settlements): acknowledge, ignore.
  return NextResponse.json({ ok: true });
}
