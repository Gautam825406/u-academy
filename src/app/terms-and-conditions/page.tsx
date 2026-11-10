import type { Metadata } from "next";
import { SiteHeader, SiteFooter, Breadcrumbs } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Terms and Conditions — U++ Academy",
  description:
    "Terms and Conditions for using the U++ Academy website and student app — enrolment, fees, classes, tests and acceptable use.",
  alternates: { canonical: "https://u-academy-zeta.vercel.app/terms-and-conditions" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Terms and Conditions" }]} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-4xl font-extrabold">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-slate-500">U++ Academy — last updated 10 November 2026.</p>
        <div className="mt-8 space-y-6 text-slate-700">
          <section><h2 className="text-xl font-extrabold text-slate-900">1. About these terms</h2><p className="mt-2">These terms apply to the U++ Academy website and student app. By registering an account, sending an enquiry, or enrolling in a batch, you agree to these terms.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">2. Enrolment</h2><p className="mt-2">Students enrol in batches for their class and board. Batch placement, timings and availability are confirmed by the academy after an admission enquiry or registration. The academy may change batch timings or assign a different teacher where needed, and will inform affected students.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">3. Fees and payments</h2><p className="mt-2">Batch fees are shown on the batch before enrolment and are paid online through the app. Enrolment is confirmed once payment is complete. Fee receipts are available in the app. Any refund, if applicable, is decided by the academy on a case-by-case basis and communicated to the parent.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">4. Classes, tests and study material</h2><p className="mt-2">Live classes, recorded lectures, study materials, assignments and tests are provided for the batches a student is enrolled in. Recorded lectures and study materials are for the enrolled student's own learning and must not be shared, copied or redistributed. Test attempts are governed by the rules set for each test, including time limits and attempt limits.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">5. Accounts and acceptable use</h2><p className="mt-2">Keep your login details private and do not share your account with others. Do not misuse the app, attempt to access other students' records, or submit work that is not your own in tests and assignments. The academy may suspend an account that misuses the platform.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">6. Demo classes</h2><p className="mt-2">A free demo class, where offered, is a single regular batch class so a student can experience the teaching before joining. It does not by itself create an enrolment.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">7. Availability</h2><p className="mt-2">The website and app are provided on a best-effort basis. Scheduled classes or features may occasionally be unavailable due to maintenance or technical issues; affected classes will be rescheduled where possible.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">8. Changes to these terms</h2><p className="mt-2">These terms may be updated from time to time. The current version is always the one published on this page.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">9. Contact</h2><p className="mt-2">For questions about these terms, send an enquiry through the admission enquiry form on the homepage or contact the academy office directly.</p></section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
