import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/cashfree/return?order_id=...
// Cashfree redirects the student here after checkout. We verify the order
// directly with Cashfree (GET /pg/orders/{order_id}) — never trust the
// redirect alone. Only when order_status is PAID do we enrol the student,
// mark the payment paid, and record a paid fees row with a receipt.
// Then redirect to the dashboard (Batches) with ?paid=1, or ?payment=failed.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const orderId = new URL(request.url).searchParams.get("order_id");
  const fail = () => NextResponse.redirect(`${origin}/payment/result?order_id=${encodeURIComponent(orderId || "")}`);
  const done = () => NextResponse.redirect(`${origin}/payment/result?order_id=${encodeURIComponent(orderId || "")}`);
  if (!orderId) return fail();

  const appId = (process.env.CASHFREE_APP_ID || "").trim();
  const secret = (process.env.CASHFREE_SECRET_KEY || "").trim();
  if (!appId || !secret) return fail();

  try {
    const supabase = createClient();
    const envRaw = (process.env.CASHFREE_ENV || "").trim().toUpperCase();
    const isProd = envRaw === "PROD" || envRaw === "PRODUCTION";
    const base = isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
    const res = await fetch(`${base}/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-client-id": appId,
        "x-client-secret": secret,
        "x-api-version": "2023-08-01",
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.order_status !== "PAID") {
      // Never overwrite a paid row with a late/duplicate failure notice.
      await supabase.from("payments").update({ status: "failed" }).eq("order_id", orderId).neq("status", "paid").neq("status", "successful");
      return fail();
    }

    const { data: payment } = await supabase.from("payments").select("*").eq("order_id", orderId).single();
    if (!payment) return fail();

    // Amount / currency / customer verification: the order Cashfree reports
    // must match the pending payment row we created server-side (price and
    // customer_id were set by create-order). A mismatch means this is not
    // the order this student was charged for — never enrol on it. Fields
    // Cashfree does not send are skipped rather than blocking a payment.
    const cfAmount = Number(data.order_amount);
    const cfCurrency = String(data.order_currency || "");
    const cfCustomer = String(data.customer_details?.customer_id || "");
    if (
      (Number.isFinite(cfAmount) && cfAmount !== Number(payment.amount)) ||
      (cfCurrency && cfCurrency !== String(payment.currency || "INR")) ||
      (cfCustomer && cfCustomer !== String(payment.student_id))
    ) {
      console.error(`[cashfree return] order ${orderId} mismatch: cashfree amount=${data.order_amount} currency=${data.order_currency} customer=${cfCustomer} vs payment amount=${payment.amount} currency=${payment.currency} student=${payment.student_id}`);
      return fail();
    }

    // Idempotency (audit #4): Cashfree can redirect here more than once,
    // and the webhook may already have enrolled this order. A payment
    // that is already paid must never create a second enrolment,
    // subscription or fee receipt.
    if (payment.status === "paid" || payment.status === "successful") return done();

    const cfPaymentId = data.cf_payment_id || (Array.isArray(data.payments) && data.payments[0]?.cf_payment_id) || null;
    await supabase.from("payments").update({ status: "paid", cf_payment_id: cfPaymentId }).eq("order_id", orderId);

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
      await supabase.from("enrollments").upsert({ batch_id: batchId, student_id: studentId, plan_id: planId, valid_until: validUntil, subscription_status: "active" }, { onConflict: "batch_id,student_id" });
      // PW-style subscription: the purchase that gives access until valid_until.
      // One subscription per order — skip if the webhook already made it.
      const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("order_id", orderId).maybeSingle();
      if (!existingSub) {
        await supabase.from("subscriptions").insert({ student_id: studentId, batch_id: batchId, plan_id: planId, plan_name: planName || null, amount_paid: amount, valid_from: new Date().toISOString().slice(0, 10), valid_until: validUntil, status: "active", order_id: orderId });
      }
    }
    if (courseId) {
      await supabase.from("course_enrollments").upsert({ course_id: courseId, student_id: studentId, price_paid: amount }, { onConflict: "course_id,student_id" });
    }
    // Paid fee receipt for the enrolment — one per order.
    const receipt = `U++-CF-${orderId.replace(/^U(?:\+\+|AA)-/, "").slice(0, 12)}`;
    const { data: existingFee } = await supabase.from("fees").select("id").eq("receipt_no", receipt).maybeSingle();
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
    return done();
  } catch {
    return fail();
  }
}
