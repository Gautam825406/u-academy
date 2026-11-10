import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter, Breadcrumbs } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "About U++ Academy | Director Umesh Kumar — Classes 6–12, Jharkhand",
  description:
    "About U++ Academy — quality education for Classes 6 to 12 in Mayurhand, Chouparan, Madhyagopali and nearby Jharkhand, led by Director Umesh Kumar. Offline classroom and online digital learning.",
  alternates: { canonical: "https://u-academy-zeta.vercel.app/about" },
  openGraph: {
    title: "About U++ Academy | Director Umesh Kumar",
    description:
      "Quality education, expert academic guidance, and smart digital learning for Classes 6 to 12.",
    url: "https://u-academy-zeta.vercel.app/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About Us" }]} />
      <main>
        <section className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand">About U++ Academy</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">About U++ Academy</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            U++ Academy is a coaching and tuition academy for students of Classes 6 to 12, serving Mayurhand, Chouparan, Madhyagopali and nearby areas of Jharkhand. The academy teaches all major school subjects across all school boards, in offline classroom batches and through its online student app.
          </p>
          <p className="mt-4 max-w-3xl text-slate-600">
            Learn. Practice. Achieve. — that is the academy's approach: structured academic learning in class, regular practice through tests and assignments, and steady improvement that students and parents can see in the app.
          </p>
        </section>

        <section className="border-y bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <h2 className="text-2xl font-extrabold">Meet Our Director</h2>
            <div className="card mt-6 grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex flex-col items-center">
                <div className="grid h-36 w-36 place-items-center rounded-full bg-gradient-to-br from-[#0c7a5f] to-[#083f31] text-5xl font-extrabold text-[#f2a007] ring-4 ring-accent/40" aria-label="Portrait placeholder for Umesh Kumar">UK</div>
                <p className="mt-3 text-center text-lg font-extrabold">Umesh Kumar</p>
                <p className="text-sm font-semibold text-slate-500">Director, U++ Academy</p>
              </div>
              <div>
                <p className="text-lg leading-relaxed text-slate-700">
                  “Under the leadership of Director Umesh Kumar, U++ Academy aims to make quality education accessible to students through structured academic learning, dedicated guidance, and modern digital education facilities.”
                </p>
                <p className="mt-2 text-xs text-slate-400">A photograph of the Director will be added here when one is provided.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="text-2xl font-extrabold">What U++ Academy offers</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Classes 6–12", "Batches organised by class, covering all major school subjects for all school boards."],
              ["Offline + Online", "Classroom teaching in small batches, plus the student app with live classes, recorded lectures and tests."],
              ["Digital Classroom", "Live classes, recordings, study materials, MCQ tests and test series, assignments, attendance, progress tracking and doubt discussion."],
            ].map(([h, p]) => (
              <article key={h} className="card"><h3 className="font-extrabold">{h}</h3><p className="mt-2 text-sm text-slate-600">{p}</p></article>
            ))}
          </div>
          <h2 className="mt-10 text-2xl font-extrabold">Where we serve</h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            U++ Academy serves students in Mayurhand, Chouparan, Madhyagopali and nearby areas of Jharkhand — see{" "}
            <Link href="/coaching-in-mayurhand" className="font-bold text-brand hover:underline">coaching in Mayurhand</Link>,{" "}
            <Link href="/coaching-in-chouparan" className="font-bold text-brand hover:underline">coaching in Chouparan</Link> and{" "}
            <Link href="/coaching-in-madhyagopali" className="font-bold text-brand hover:underline">coaching in Madhyagopali</Link>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/#classes" className="btn-brand">Explore Courses</a>
            <a href="/#demo" className="btn-ghost">Send an admission enquiry</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
