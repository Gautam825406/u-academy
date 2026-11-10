import type { Metadata } from "next";
import { SiteHeader, SiteFooter, Breadcrumbs } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Privacy Policy — U++ Academy",
  description:
    "Privacy Policy for U++ Academy — how student, parent and teacher information submitted through the website and student app is collected, used and protected.",
  alternates: { canonical: "https://u-academy-zeta.vercel.app/privacy-policy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Privacy Policy" }]} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-4xl font-extrabold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">U++ Academy — last updated 10 November 2026.</p>
        <div className="mt-8 space-y-6 text-slate-700">
          <section><h2 className="text-xl font-extrabold text-slate-900">1. Information we collect</h2><p className="mt-2">When you use this website or the U++ Academy student app, we collect the information you provide directly: student and parent names, mobile numbers, class and board, and the contents of admission enquiries and teacher applications. Registered users also provide an email address and password. The app records academic information needed for teaching: enrolments, attendance, assignment submissions, test attempts and results, fees and receipts.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">2. How we use it</h2><p className="mt-2">We use this information to run the academy: to place students in batches, deliver classes and study material, mark attendance, evaluate assignments and tests, keep parents informed of progress, and record fees. We do not sell personal information to anyone.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">3. Payments</h2><p className="mt-2">Batch fees paid online are processed by our payment partner, Cashfree. Card and bank details are handled by the payment partner; U++ Academy does not store card numbers on its own systems. We keep a record of the payment amount, status and receipt for fee accounting.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">4. Who can see your information</h2><p className="mt-2">Students see their own records. Parents linked to a student can see that student's attendance, results and fees. Teachers see the students in their own batches. Academy administrators manage accounts and batches. We do not share personal information with third parties except the service providers needed to run the website and app (hosting, database and payment processing), who handle it only as instructed.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">5. Data security and retention</h2><p className="mt-2">Accounts are protected by passwords, and access is limited by role. We keep academic and fee records for as long as a student is enrolled and for a reasonable period afterwards for certificates and fee history. You may ask for your account information to be corrected or for an account to be closed by contacting the academy office.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">6. Children's information</h2><p className="mt-2">Most of our students are under 18. Accounts and enquiries for students are created by or with the involvement of a parent or guardian, and parents can view their child's academic records through the parent view of the app.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">7. Changes to this policy</h2><p className="mt-2">If this policy changes, the updated version will be posted on this page with a new last-updated date.</p></section>
          <section><h2 className="text-xl font-extrabold text-slate-900">8. Contact</h2><p className="mt-2">For questions about this policy or your information, send an enquiry through the admission enquiry form on the homepage or contact the academy office directly.</p></section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
