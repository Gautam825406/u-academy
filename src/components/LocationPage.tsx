import Link from "next/link";
import { SiteHeader, SiteFooter, Breadcrumbs, LOCATIONS } from "@/components/SiteChrome";

export type LocationContent = {
  slug: string;
  name: string;
  intro: string;
  why: string[];
  nearby: string;
};

export default function LocationPage({ loc }: { loc: LocationContent }) {
  return (
    <div className="overflow-x-clip">
      <SiteHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: `Coaching in ${loc.name}` }]} />
      <main>
        <section className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Coaching · Classes 6–12 · {loc.name}, Jharkhand</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            Coaching Classes in {loc.name} — U++ Academy
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-600">{loc.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/#classes" className="btn-brand">Explore Courses</a>
            <a href="/#demo" className="btn-ghost">Join U++ Academy</a>
          </div>
        </section>

        <section className="border-y bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <h2 className="text-2xl font-extrabold">Tuition for Classes 6 to 12 in {loc.name}</h2>
            <p className="mt-3 max-w-3xl text-slate-600">
              U++ Academy teaches students of Classes 6, 7, 8, 9, 10, 11 and 12, across all school boards, covering all major school subjects — Mathematics, Science, Physics, Chemistry, Biology, English, Hindi, Social Science and more. Batches are organised by class, so every student learns with classmates at the same level.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ["Class 6–8 · Foundation", "Concept-based learning in Maths, Science, English and Social Science, with daily practice and regular revision."],
                ["Class 9–10 · Board Preparation", "Chapter tests after every chapter, unit tests, and full revision before board examinations."],
                ["Class 11–12 · Senior Secondary", "Subject-wise teaching for Science and Commerce streams, with numerical practice, case studies and exam-pattern tests."],
              ].map(([h, p]) => (
                <article key={h} className="card"><h3 className="font-extrabold">{h}</h3><p className="mt-2 text-sm text-slate-600">{p}</p></article>
              ))}
            </div>
            <p className="mt-6 text-slate-600">
              See the batches currently open on the <Link href="/#classes" className="font-bold text-brand hover:underline">Classes &amp; Batches</Link> section of the homepage — every batch shows its class, board, subjects and fee.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="text-2xl font-extrabold">Online and offline learning for {loc.name} students</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <article className="card">
              <h3 className="text-lg font-extrabold">Offline classroom learning</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>✓ Classroom-based teaching in small batches</li>
                <li>✓ Direct teacher interaction and doubt-solving</li>
                <li>✓ Concept-based learning with regular practice</li>
              </ul>
            </article>
            <article className="card">
              <h3 className="text-lg font-extrabold">Online digital learning</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>✓ Live classes and recorded lectures</li>
                <li>✓ Study materials, MCQ tests and test series</li>
                <li>✓ Assignments, attendance and progress tracking</li>
                <li>✓ Doubt discussion with teachers</li>
              </ul>
            </article>
          </div>
          <h2 className="mt-10 text-2xl font-extrabold">Why families in {loc.name} choose U++ Academy</h2>
          <ul className="mt-4 space-y-2 text-slate-600">
            {loc.why.map((w) => <li key={w}>✓ {w}</li>)}
          </ul>
          <p className="mt-6 text-slate-600">{loc.nearby}</p>
          <h2 className="mt-10 text-2xl font-extrabold">Also serving nearby areas</h2>
          <p className="mt-3 text-slate-600">
            U++ Academy also serves students in{" "}
            {LOCATIONS.filter((l) => l.slug !== loc.slug).map((l, i, arr) => (
              <span key={l.slug}>
                <Link href={`/coaching-in-${l.slug}`} className="font-bold text-brand hover:underline">{l.name}</Link>
                {i < arr.length - 1 ? " and " : ""}
              </span>
            ))}{" "}
            and nearby areas of Jharkhand. <Link href="/" className="font-bold text-brand hover:underline">Back to the homepage</Link> or <Link href="/about" className="font-bold text-brand hover:underline">read about U++ Academy</Link>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/#demo" className="btn-brand">Send an admission enquiry</a>
            <Link href="/auth/register" className="btn-ghost">Register &amp; join a batch</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
