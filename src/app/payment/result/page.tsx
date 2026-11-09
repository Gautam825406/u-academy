"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// /payment/result?order_id=...
// The payments row in Supabase is the source of truth for the outcome.
// URL params only carry the order_id — never the status. A stale or
// tampered ?paid=1 / ?payment=failed param cannot fake a success here:
// without an order_id we show a generic message and link to the dashboard.

type PaymentRow = {
  order_id: string;
  amount: number | null;
  currency: string | null;
  status: string;
  batch_id: string | null;
  course_id: string | null;
  cf_payment_id: string | null;
  payment_mode: string | null;
  created_at: string;
};

function ResultContent() {
  const params = useSearchParams();
  const orderId = params.get("order_id") || "";
  const legacyPaid = params.get("paid");
  const legacyFailed = params.get("payment");
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [batchName, setBatchName] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from("payments")
          .select("*")
          .eq("order_id", orderId)
          .maybeSingle();
        if (err) throw err;
        if (!data) {
          setPayment(null);
        } else {
          setPayment(data as PaymentRow);
          if (data.batch_id) {
            const { data: b } = await supabase.from("batches").select("name").eq("id", data.batch_id).single();
            if (b) setBatchName(String(b.name));
          }
          if (data.course_id) {
            const { data: c } = await supabase.from("courses").select("title").eq("id", data.course_id).single();
            if (c) setCourseName(String(c.title));
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not load the payment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const status = payment?.status || "";
  const isPaid = status === "paid" || status === "successful";
  const isFailed = status === "failed";
  const isPending = !!payment && !isPaid && !isFailed;

  const box = "mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm";
  const btnPrimary =
    "inline-block rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800";
  const btnGhost =
    "inline-block rounded-xl border px-4 py-2.5 text-sm font-bold hover:bg-gray-50";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className={box}>
        {loading ? (
          <>
            <p className="text-4xl">⏳</p>
            <h1 className="mt-3 text-xl font-bold">Checking your payment…</h1>
            <p className="mt-1 text-sm text-gray-600">
              Please wait while we confirm the payment status.
            </p>
          </>
        ) : !orderId ? (
          <>
            <p className="text-4xl">ℹ️</p>
            <h1 className="mt-3 text-xl font-bold">Payment status</h1>
            <p className="mt-1 text-sm text-gray-600">
              {legacyPaid === "1"
                ? "Your payment was submitted. Open your dashboard to confirm the enrolment — it appears once the payment is verified."
                : legacyFailed === "failed"
                  ? "The payment did not go through. No money was taken for this attempt — you can try again from your batches."
                  : "No payment reference was provided, so we cannot show a receipt here. Check your payments in the dashboard."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard?section=batches" className={btnPrimary}>
                My Batches →
              </Link>
              <Link href="/dashboard?section=fees" className={btnGhost}>
                My Payments
              </Link>
            </div>
          </>
        ) : !payment ? (
          <>
            <p className="text-4xl">🔍</p>
            <h1 className="mt-3 text-xl font-bold">Payment not found</h1>
            <p className="mt-1 text-sm text-gray-600">
              We could not find a payment with order id{" "}
              <span className="font-mono font-bold text-gray-900">{orderId}</span>. It may
              still be processing, or the link may be wrong. Check your payments in the
              dashboard, or try again.
            </p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard?section=batches" className={btnPrimary}>
                My Batches →
              </Link>
              <Link href="/dashboard?section=fees" className={btnGhost}>
                My Payments
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-4xl">{isPaid ? "✅" : isFailed ? "❌" : "⏳"}</p>
            <h1 className="mt-3 text-xl font-bold">
              {isPaid
                ? "Payment successful"
                : isFailed
                  ? "Payment failed"
                  : "Payment pending"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isPaid
                ? "Your payment is confirmed and your enrolment is active."
                : isFailed
                  ? "This payment did not go through. No enrolment was made — you can try again."
                  : "Your payment is still being verified. This page updates once Cashfree confirms it — check back in a few minutes."}
            </p>
            <dl className="mt-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Order ID</dt>
                <dd className="font-mono font-bold break-all text-right">{payment.order_id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Amount</dt>
                <dd className="font-bold">
                  ₹{Number(payment.amount || 0).toLocaleString("en-IN")}{" "}
                  {payment.currency || "INR"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">{courseName ? "Course" : "Batch"}</dt>
                <dd className="font-bold text-right">{batchName || courseName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Payment status</dt>
                <dd className="font-bold capitalize">{payment.status}</dd>
              </div>
              {payment.cf_payment_id && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Cashfree payment ID</dt>
                  <dd className="font-mono text-right break-all">{payment.cf_payment_id}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Date</dt>
                <dd className="text-right">
                  {new Date(payment.created_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard?section=batches" className={btnPrimary}>
                My Batches →
              </Link>
              <Link href="/dashboard?section=fees" className={btnGhost}>
                My Payments
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 px-4 py-10">
          <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-4xl">⏳</p>
            <h1 className="mt-3 text-xl font-bold">Checking your payment…</h1>
          </div>
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
