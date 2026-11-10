import Link from "next/link";

export const LOCATIONS = [
  { slug: "mayurhand", name: "Mayurhand" },
  { slug: "chouparan", name: "Chouparan" },
  { slug: "madhyagopali", name: "Madhyagopali" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-[#f4f7f8]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg">
          <img src="/logo.jpg" alt="U++ Academy" className="h-10 w-10 rounded-xl object-cover" />
          <span>
            U++ Academy
            <small className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Learn. Practice. Achieve.
            </small>
          </span>
        </Link>
        <nav className="ml-auto hidden gap-1 md:flex" aria-label="Main navigation">
          <Link href="/#classes" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Classes</Link>
          <Link href="/#subjects" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Subjects</Link>
          <Link href="/#learning" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Learning</Link>
          <Link href="/about" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">About</Link>
          <Link href="/#faq" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">FAQ</Link>
        </nav>
        <Link href="/auth/login" className="btn-ghost !px-4 !py-2 text-sm">Login</Link>
        <Link href="/auth/register" className="btn-brand !px-4 !py-2 text-sm">Register</Link>
      </div>
    </header>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-5 pt-6 text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {it.href ? (
              <Link href={it.href} className="font-semibold text-brand hover:underline">{it.label}</Link>
            ) : (
              <span aria-current="page" className="font-semibold text-slate-700">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-[#083f31] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <img src="/logo.jpg" alt="U++ Academy" className="h-10 w-10 rounded-xl object-cover" />
            <span>U++ Academy</span>
          </div>
          <p className="mt-3 text-sm text-white/70">Learn. Practice. Achieve.</p>
          <p className="mt-2 text-sm text-white/70">
            Quality education, expert academic guidance, and smart digital learning for students from Class 6 to Class 12.
          </p>
          <p className="mt-3 text-sm font-semibold">Director: Umesh Kumar</p>
        </div>
        <nav aria-label="Classes">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white/60">Classes</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].map((c) => (
              <li key={c}><Link href="/#classes" className="hover:text-white hover:underline">{c}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Explore">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white/60">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link href="/about" className="hover:text-white hover:underline">About U++ Academy</Link></li>
            <li><Link href="/#learning" className="hover:text-white hover:underline">Online Learning</Link></li>
            <li><Link href="/#learning" className="hover:text-white hover:underline">Offline Learning</Link></li>
            <li><Link href="/#classes" className="hover:text-white hover:underline">Available Batches</Link></li>
            <li><Link href="/#demo" className="hover:text-white hover:underline">Admission Enquiry</Link></li>
            <li><Link href="/#faq" className="hover:text-white hover:underline">FAQs</Link></li>
          </ul>
        </nav>
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white/60">Locations Served</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {LOCATIONS.map((l) => (
              <li key={l.slug}>
                <Link href={`/coaching-in-${l.slug}`} className="hover:text-white hover:underline">
                  Coaching in {l.name}
                </Link>
              </li>
            ))}
            <li className="text-white/60">Nearby areas of Jharkhand</li>
          </ul>
          <h3 className="mt-6 text-sm font-extrabold uppercase tracking-widest text-white/60">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link href="/privacy-policy" className="hover:text-white hover:underline">Privacy Policy</Link></li>
            <li><Link href="/terms-and-conditions" className="hover:text-white hover:underline">Terms and Conditions</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-5 text-center text-sm text-white/60">
          U++ Academy — Quality Education. Smart Learning. Brighter Futures. · Director: Umesh Kumar · Classes 6–12 · All Boards
        </p>
      </div>
    </footer>
  );
}
