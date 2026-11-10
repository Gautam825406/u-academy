"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import InstallAppButton from "@/components/InstallAppButton";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

const SUBJECTS = [
  "Mathematics", "Science", "Physics", "Chemistry", "Biology", "English", "Hindi",
  "Social Science", "History", "Geography", "Political Science", "Economics",
  "Accountancy", "Business Studies", "Computer Science",
];

const QUIZ = [
  { q: "Q1 · Maths. The roots of x² − 5x + 6 = 0 are…", opts: ["1 and 6", "2 and 3", "−2 and −3"], ans: 1 },
  { q: "Q2 · Science. Which gas is released when zinc reacts with dilute hydrochloric acid?", opts: ["Oxygen", "Carbon dioxide", "Hydrogen"], ans: 2 },
  { q: "Q3 · Maths. The value of sin 30° is…", opts: ["1/2", "√3/2", "1"], ans: 0 },
];

const FAQS = [
  ["Which classes and boards does U++ Academy cover?", "Classes 6 to 12, for students of all school boards. Batches cover all major school subjects, and the exact batch for a class and board is confirmed when you enquire."],
  ["Does U++ Academy offer online and offline classes?", "Yes. Students can learn in offline classroom batches and through the online student app — live classes, recorded lectures, study materials, online tests and assignments."],
  ["Which areas does U++ Academy serve?", "Mayurhand, Chouparan, Madhyagopali and nearby areas of Jharkhand. Online learning through the student app is available wherever students can access it."],
  ["How do I enrol in a batch?", "Send an admission enquiry using the form on this page, or register on this website and choose a batch from the student dashboard. Batch fees are paid online through the app, and enrolment is confirmed once payment is complete."],
  ["What does the student app include?", "Live classes, recorded lectures, study materials, MCQ tests and test series, assignments, attendance, progress tracking and a doubt discussion forum — all for the batches a student is enrolled in."],
  ["Can I try a class before joining?", "Yes. Use the free demo class enquiry form on this page. The academy will arrange a demo class for the student's class and board."],
  ["Who leads U++ Academy?", "U++ Academy is led by its Director, Umesh Kumar."],
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "U++ Academy",
  slogan: "Learn. Practice. Achieve.",
  description:
    "Quality education, expert academic guidance, and smart digital learning for students from Class 6 to Class 12.",
  url: "https://u-academy-zeta.vercel.app",
  founder: { "@type": "Person", name: "Umesh Kumar", jobTitle: "Director" },
  areaServed: [
    { "@type": "Place", name: "Mayurhand, Jharkhand" },
    { "@type": "Place", name: "Chouparan, Jharkhand" },
    { "@type": "Place", name: "Madhyagopali, Jharkhand" },
  ],
};

type Batch = {
  id: string;
  name: string;
  class_label: string | null;
  board: string | null;
  subject: string | null;
  price: number | null;
  status: string | null;
  description: string | null;
  thumbnail_url: string | null;
  demo_pdf_url: string | null;
};

function classNum(label: string | null): number {
  const m = (label || "").match(/\d+/);
  return m ? Number(m[0]) : 99;
}

export default function Landing() {
  const [tab, setTab] = useState<"home" | "lectures" | "tests" | "progress">("home");
  const [lecFilter, setLecFilter] = useState("All");
  const [roleTab, setRoleTab] = useState<"student" | "parent" | "teacher">("student");
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [score, setScore] = useState<number | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoaded, setBatchesLoaded] = useState(false);
  const [enq, setEnq] = useState({ student_name: "", parent_mobile: "", class_label: "Class 10", board: "CBSE", interested_in: "", notes: "" });
  const [enqMsg, setEnqMsg] = useState("");
  const [enqText, setEnqText] = useState("");
  const [teach, setTeach] = useState({ full_name: "", email: "", mobile: "", subject: "Mathematics", experience_years: "", qualification: "" });
  const [teachMsg, setTeachMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("batches")
          .select("id,name,class_label,board,subject,price,status,description,thumbnail_url,demo_pdf_url")
          .eq("status", "active")
          .order("class_label");
        if (data) setBatches((data as Batch[]).sort((a, b) => classNum(a.class_label) - classNum(b.class_label)));
      } catch {
        // Batches section falls back to the class list with an enquiry note.
      } finally {
        setBatchesLoaded(true);
      }
    })();
  }, []);

  async function submitTeacherRequest(e: React.FormEvent) {
    e.preventDefault(); setTeachMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("teacher_requests").insert({
        full_name: teach.full_name, email: teach.email, mobile: teach.mobile,
        subject: teach.subject, experience_years: teach.experience_years ? Number(teach.experience_years) : null,
        qualification: teach.qualification,
      });
      if (error) throw error;
      setTeachMsg("Request sent — Admin will review it. Once approved, register on this site with the same email and your Teacher role will be confirmed.");
      setTeach({ full_name: "", email: "", mobile: "", subject: "Mathematics", experience_years: "", qualification: "" });
    } catch {
      setTeachMsg("Could not send your request — please check your connection and try again, or contact the academy office directly.");
    }
  }

  async function submitEnquiry(e: React.FormEvent) {
    e.preventDefault();
    const text = `Admission enquiry — U++ Academy\nStudent: ${enq.student_name}\nParent mobile: ${enq.parent_mobile}\nClass: ${enq.class_label} · Board: ${enq.board}\nInterested in: ${enq.interested_in || "-"}\nNotes: ${enq.notes || "-"}`;
    setEnqText(text);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").insert(enq);
      setEnqMsg(error ? "Saved locally below — the online save failed. Copy the enquiry and share it with the academy office." : "Enquiry saved. Copy it below and share it with the academy office to confirm your slot.");
    } catch {
      setEnqMsg("The online save is not available right now — copy the enquiry below and share it with the academy office.");
    }
  }

  return (
    <div className="overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />

      {/* HERO */}
      <section className="bg-[#eaf1f0]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow">
              <span className="h-2 w-2 rounded-full bg-accent" />Admissions open — Classes 6 to 12 · Mayurhand, Chouparan &amp; Madhyagopali
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Build a Strong Academic Future with <span className="text-brand">U++ Academy</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">
              Quality education, expert academic guidance, and smart digital learning for students from Class 6 to Class 12.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {["Online and Offline Classes", "All Major School Subjects", "All School Boards", "Live Classes and Recorded Lectures", "Online Tests and Assignments", "Digital Study Materials"].map((c) => (
                <li key={c} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">✓ {c}</li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#classes" className="btn-brand">Explore Courses</a>
              <a href="#demo" className="btn-ghost">Join U++ Academy</a>
              <InstallAppButton />
            </div>
            <p className="mt-6 text-sm font-semibold text-slate-600">Learn. Practice. Achieve. — Quality Education. Smart Learning. Brighter Futures.</p>
          </div>

          {/* Phone mockup — app preview */}
          <div id="app" className="flex justify-center">
            <div className="w-full max-w-[340px] rounded-[48px] bg-slate-900 p-3 shadow-2xl">
              <div className="flex h-[620px] flex-col overflow-hidden rounded-[38px] bg-[#f7faf9]">
                <div className="flex justify-between px-5 pt-3 text-xs font-bold"><span>9:41</span><span>● ● ●</span></div>
                <div className="flex-1 overflow-y-auto px-4 pb-3">
                  {tab === "home" && (<>
                    <div className="mt-2 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand font-extrabold text-white">U+</span><div className="flex-1"><span className="block text-xs text-slate-500">Namaste,</span><b>Student · Class 10</b></div><span className="relative grid h-9 w-9 place-items-center rounded-xl border bg-white">🔔<span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] text-white">3</span></span></div>
                    <div className="mt-4 rounded-2xl bg-gradient-to-r from-brand to-brand-dark p-4 text-white"><span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-extrabold tracking-wider">● LIVE TODAY · 4:00 PM</span><h3 className="mt-2 font-bold">Mathematics — Quadratic Equations</h3><p className="text-xs opacity-80">Class 10 Batch · with recorded backup</p><button className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-brand-dark">Open classroom →</button></div>
                    <h4 className="mb-2 mt-5 flex justify-between text-sm font-extrabold">Continue learning <span className="text-xs text-brand">All lectures</span></h4>
                    <div className="rounded-2xl border bg-white p-3"><b className="text-sm">Light — Reflection &amp; Refraction</b><p className="text-xs text-slate-500">Science · Chapter 10 · 12 min left</p><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 w-2/3 rounded-full bg-brand" /></div></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl border bg-white p-3"><b>92%</b><span className="block text-[10px] font-bold text-slate-500">ATTENDANCE</span></div>
                      <div className="rounded-2xl border bg-white p-3"><b>4 / 5</b><span className="block text-[10px] font-bold text-slate-500">HOMEWORK DONE</span></div>
                      <div className="rounded-2xl border bg-white p-3"><b>78%</b><span className="block text-[10px] font-bold text-slate-500">LAST TEST</span></div>
                    </div>
                    <h4 className="mb-2 mt-5 text-sm font-extrabold">To-do</h4>
                    <div className="space-y-2">
                      <div className="rounded-2xl border bg-white p-3 text-sm"><b>Science worksheet — Life Processes</b><p className="text-xs text-slate-500">Submit photo or PDF from the app</p><span className="mt-1 inline-block rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-extrabold text-accent-ink">Tomorrow</span></div>
                      <div className="rounded-2xl border bg-white p-3 text-sm"><b>English grammar quiz</b><p className="text-xs text-slate-500">10 questions · 10 minutes</p></div>
                    </div>
                  </>)}
                  {tab === "lectures" && (<>
                    <h4 className="mt-3 text-sm font-extrabold">Video Lectures</h4>
                    <div className="mt-2 flex gap-2 overflow-x-auto">{["All", "Maths", "Science", "English"].map((c) => <button key={c} onClick={() => setLecFilter(c)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${lecFilter === c ? "bg-brand text-white" : "bg-white"}`}>{c}</button>)}</div>
                    <div className="mt-2 divide-y">
                      {[
                        { t: "Quadratic Equations — Introduction", s: "Maths · Chapter 4 · Notes attached", d: "24:10", st: "Done" },
                        { t: "Light — Reflection & Refraction", s: "Science · Chapter 10 · Resume at 16:20", d: "28:02", st: "68%" },
                        { t: "Chemical Reactions & Equations", s: "Science · Chapter 1 · New", d: "22:37", st: "New" },
                      ].filter((l) => lecFilter === "All" || l.s.includes(lecFilter)).map((l) => (
                        <div key={l.t} className="flex gap-3 py-3"><span className="grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-brand-tint text-xl">▶</span><div className="min-w-0 flex-1"><b className="block text-[13px] leading-snug">{l.t}</b><span className="text-xs text-slate-500">{l.s} · {l.d}</span></div><span className="text-[11px] font-extrabold text-brand">{l.st}</span></div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Missed a class? Every lecture lands here with notes, so revision never depends on memory.</p>
                  </>)}
                  {tab === "tests" && (<>
                    <h4 className="mt-3 text-sm font-extrabold">Practice test · Quick Check · Mixed Bag</h4>
                    <p className="text-xs text-slate-500">3 questions, just like the weekly tests in the app.</p>
                    {QUIZ.map((q, qi) => (
                      <div key={qi} className="mt-3 rounded-2xl border bg-white p-3"><p className="text-sm font-bold">{q.q}</p>
                        {q.opts.map((o, oi) => (
                          <button key={oi} onClick={() => { const a = [...answers]; a[qi] = oi; setAnswers(a); setScore(null); }} className={`mt-2 block w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold ${answers[qi] === oi ? "border-brand bg-brand-tint" : "bg-slate-50"}`}>{o}</button>
                        ))}
                      </div>
                    ))}
                    <button onClick={() => setScore(answers.filter((a, i) => a === QUIZ[i].ans).length)} className="btn-brand mt-3 w-full !py-2.5 text-sm">Check answers</button>
                    {score !== null && <p className="mt-2 text-center font-extrabold text-brand">You scored {score} / 3 {score === 3 ? "— excellent!" : "— keep practising."}</p>}
                  </>)}
                  {tab === "progress" && (<>
                    <h4 className="mt-3 text-sm font-extrabold">My report · Progress — This Term</h4>
                    <div className="mt-3 flex items-center gap-4 rounded-2xl border bg-white p-4"><span className="grid h-20 w-20 place-items-center rounded-full border-8 border-brand text-lg font-extrabold">92%</span><div><b>Attendance</b><p className="text-xs text-slate-500">Classes attended this term. Parents see this same report.</p></div></div>
                    <h4 className="mb-2 mt-4 text-sm font-extrabold">Subject performance</h4>
                    {[["Mathematics", 78], ["Science", 84], ["English", 71], ["Social Science", 88]].map(([s, v]) => <div key={s as string} className="mb-2"><div className="flex justify-between text-xs font-bold"><span>{s}</span><span className="text-brand">{v}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${v}%` }} /></div></div>)}
                  </>)}
                </div>
                <div className="grid grid-cols-4 border-t bg-white px-2 py-2 pb-4">
                  {(["home", "lectures", "tests", "progress"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-bold capitalize ${tab === t ? "text-brand" : "text-slate-400"}`}>{t === "home" ? "🏠" : t === "lectures" ? "▶" : t === "tests" ? "✏" : "📈"}{t}</button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-y bg-white"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-4 text-sm font-bold text-slate-600"><span>✓ Small batches, personal attention</span><span>✓ Every class recorded for revision</span><span>✓ Weekly tests, checked with feedback</span><span>✓ Parents updated every week</span></div></div>

      {/* DIRECTOR */}
      <section id="director" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Leadership</p>
        <h2 className="mt-2 text-3xl font-extrabold">Meet Our Director</h2>
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
            <p className="mt-4 text-sm text-slate-500">
              U++ Academy serves students of Classes 6 to 12 in Mayurhand, Chouparan, Madhyagopali and nearby areas of Jharkhand — in the classroom and through its digital learning app.
            </p>
            <p className="mt-2 text-xs text-slate-400">A photograph of the Director will be added here when one is provided.</p>
          </div>
        </div>
      </section>

      {/* CLASSES — real batch data */}
      <section id="classes" className="border-y bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Classes &amp; Batches</p>
          <h2 className="mt-2 text-3xl font-extrabold">Classes 6 to 12 — find your batch</h2>
          <p className="mt-2 max-w-2xl text-slate-600">These are the batches currently open at U++ Academy. Every batch covers all major school subjects for its class. Enrol from the student app after registering, or send an admission enquiry below.</p>
          {!batchesLoaded && <p className="mt-6 text-sm text-slate-500">Loading batches…</p>}
          {batchesLoaded && batches.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {batches.map((b) => (
                <article key={b.id} className="card flex flex-col">
                  {b.thumbnail_url ? (
                    <img src={b.thumbnail_url} alt={b.name} loading="lazy" className="mb-3 h-36 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="mb-3 grid h-24 place-items-center rounded-xl bg-brand-tint text-2xl font-extrabold text-brand">{b.class_label || b.name}</div>
                  )}
                  <span className="inline-block w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-extrabold text-white">{b.board || "All Boards"}</span>
                  <h3 className="mt-3 text-xl font-extrabold">{b.name}</h3>
                  {b.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{b.description}</p>}
                  <dl className="mt-3 space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><dt className="font-semibold">Subjects</dt><dd>{b.subject || "All Subjects"}</dd></div>
                    <div className="flex justify-between"><dt className="font-semibold">Fee</dt><dd className="font-extrabold text-slate-900">{b.price == null ? "On enquiry" : b.price === 0 ? "Free" : `₹${b.price}`}</dd></div>
                    <div className="flex justify-between"><dt className="font-semibold">Status</dt><dd className="font-semibold text-brand">Open</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/auth/register" className="btn-brand !py-2.5 text-sm">Join this batch</Link>
                    {b.demo_pdf_url && <a href={b.demo_pdf_url} target="_blank" rel="noreferrer" className="btn-ghost !py-2.5 text-sm">Free demo lecture (PDF)</a>}
                  </div>
                </article>
              ))}
            </div>
          )}
          {batchesLoaded && batches.length === 0 && (
            <div className="card mt-6">
              <p className="text-slate-600">We teach Classes 6 to 12 across all major school subjects. Batch timings, availability and fees are confirmed when you send an admission enquiry — use the form below and the academy will get back to you.</p>
              <div className="mt-3 flex flex-wrap gap-2">{["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].map((c) => <span key={c} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600">{c}</span>)}</div>
            </div>
          )}
          <p className="mt-4 text-sm text-slate-500">Serving Mayurhand, Chouparan, Madhyagopali and nearby areas of Jharkhand — <Link href="/coaching-in-mayurhand" className="font-bold text-brand hover:underline">coaching in Mayurhand</Link>, <Link href="/coaching-in-chouparan" className="font-bold text-brand hover:underline">coaching in Chouparan</Link>, <Link href="/coaching-in-madhyagopali" className="font-bold text-brand hover:underline">coaching in Madhyagopali</Link>.</p>
        </div>
      </section>

      {/* SUBJECTS */}
      <section id="subjects" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Subjects</p>
        <h2 className="mt-2 text-3xl font-extrabold">All major school subjects, covered across Classes 6–12</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Subjects are taught as part of each class batch — every batch covers all major school subjects for its class, so students do not need a separate enrolment per subject.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {SUBJECTS.map((s) => <span key={s} className="rounded-full border bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">{s}</span>)}
        </div>
      </section>

      {/* ONLINE VS OFFLINE */}
      <section id="learning" className="border-y bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand">How you learn</p>
          <h2 className="mt-2 text-3xl font-extrabold">Offline classroom learning, online digital learning — or both</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <article className="card">
              <h3 className="text-xl font-extrabold">Offline Classroom Learning</h3>
              <p className="mt-1 text-sm text-slate-500">Learn face to face with your teachers, in small batches.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>✓ Classroom-based teaching</li>
                <li>✓ Direct teacher interaction</li>
                <li>✓ Concept-based learning</li>
                <li>✓ Regular academic practice</li>
                <li>✓ Doubt-solving support</li>
              </ul>
            </article>
            <article className="card">
              <h3 className="text-xl font-extrabold">Online Digital Learning</h3>
              <p className="mt-1 text-sm text-slate-500">The student app carries learning home with you.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>✓ Live classes</li>
                <li>✓ Recorded lectures</li>
                <li>✓ Study materials</li>
                <li>✓ MCQ tests and test series</li>
                <li>✓ Assignments</li>
                <li>✓ Attendance and progress tracking</li>
                <li>✓ Doubt discussion with teachers</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* DIGITAL CLASSROOM */}
      <section id="digital" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Digital Classroom</p>
        <h2 className="mt-2 text-3xl font-extrabold">Everything a student needs, in one app</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Once enrolled in a batch, students get the full digital classroom — the same tools teachers use every day.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            ["Live Classes", "Join scheduled classes from the app, with the timetable for your batch."],
            ["Recordings", "Every lecture is recorded — revise any chapter, any time, with the teacher's notes."],
            ["Assignments", "Homework and practice sets with deadlines, submitted from the app."],
            ["Attendance", "Daily attendance recorded per batch, visible to students and parents."],
            ["Study Materials", "Notes, worksheets and reference material, organised by class and subject."],
            ["Online Tests", "MCQ tests with instant results, negative marking and explanations where provided."],
            ["Test Series", "Regular test series that build exam readiness chapter by chapter."],
            ["Doubt Discussion", "Ask a doubt any evening — teachers answer and close it as resolved."],
            ["Student Progress", "Marks, attendance and weak areas in one place, shared with parents."],
          ].map(([h, p]) => <div key={h} className="card"><h3 className="font-extrabold">{h}</h3><p className="mt-2 text-sm text-slate-600">{p}</p></div>)}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">{(["student", "parent", "teacher"] as const).map((r) => <button key={r} onClick={() => setRoleTab(r)} className={`rounded-full border px-4 py-2 text-sm font-bold capitalize ${roleTab === r ? "bg-brand text-white" : "bg-white"}`}>For {r}s</button>)}</div>
        <div className="card mt-4">
          {roleTab === "student" && <><h3 className="text-lg font-extrabold">The student’s whole school day, after school</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>✓ Today’s classes and one-tap join for live sessions</li><li>✓ Assignments with deadlines, submitted by photo or PDF</li><li>✓ Marks, remarks and a weak-chapter list that updates itself</li><li>✓ Ask-a-doubt chat with your own teachers</li></ul></>}
          {roleTab === "parent" && <><h3 className="text-lg font-extrabold">No more “how was tuition today?”</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>✓ Attendance percentage and absence alerts</li><li>✓ Every test result with the teacher’s remarks</li><li>✓ Pending assignments at a glance</li><li>✓ Fee status and receipts in one place</li></ul></>}
          {roleTab === "teacher" && <><h3 className="text-lg font-extrabold">Teachers teach. The app does the paperwork.</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>✓ Create batches and publish lectures in minutes</li><li>✓ Mark attendance once — parents are informed automatically</li><li>✓ Evaluate submissions with marks and feedback inline</li><li>✓ Announcements to a batch, a subject, or parents only</li></ul></>}
        </div>
      </section>

      {/* STEPS + FAQ */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold">Joining U++ takes one enquiry</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[["1", "Send an admission enquiry", "Fill the enquiry form below with the student's class and board. The academy confirms the right batch and a free demo class."], ["2", "Get placed in the right batch", "After the demo, the student is placed by class, board and current level, and their app account is set up with the batch timetable."], ["3", "Learn, test, improve — visibly", "Lectures, homework, tests and reports start flowing into the app from day one, so progress is something you can see, not guess."]].map(([n, h, p]) => <div key={n} className="card"><span className="grid h-11 w-11 place-items-center rounded-full bg-brand font-extrabold text-white">{n}</span><h3 className="mt-3 font-extrabold">{h}</h3><p className="mt-1 text-sm text-slate-600">{p}</p></div>)}
        </div>
        <h2 id="faq" className="mt-14 text-center text-3xl font-extrabold">Parents usually ask us…</h2>
        <div className="mx-auto mt-6 max-w-3xl space-y-3">{FAQS.map(([q, a]) => <details key={q} className="card !p-4"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-2 text-sm text-slate-600">{a}</p></details>)}</div>
      </section>

      {/* JOIN AS A TEACHER */}
      <section id="teach" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-8 rounded-[28px] border bg-white p-8 shadow-sm md:grid-cols-2">
          <div><p className="text-xs font-extrabold uppercase tracking-widest text-brand">Teach with U++</p><h2 className="mt-2 text-3xl font-extrabold">Join as a Teacher</h2><p className="mt-2 text-slate-600">Teach Maths, Science, English or Commerce to small, focused batches — with the student app doing the paperwork: attendance, assignments, tests and parent updates.</p>
          <ul className="mt-5 space-y-2 text-sm font-semibold text-slate-600"><li>✓ Small batches — every student known by name</li><li>✓ Recorded lectures and ready-made test patterns</li><li>✓ Admin reviews every application before onboarding</li></ul>
          <p className="mt-5 text-sm text-slate-500">Already approved by Admin? <Link href="/auth/register" className="font-bold text-brand">Register here</Link> with the same email — your Teacher role will be confirmed automatically.</p></div>
          <form onSubmit={submitTeacherRequest} className="rounded-2xl bg-slate-50 p-6">
            <h3 className="font-extrabold">Teacher application</h3><p className="text-sm text-slate-500">Send your request — the Admin reviews it in the dashboard.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="label">Full name</label><input required className="input" value={teach.full_name} onChange={(e) => setTeach({ ...teach, full_name: e.target.value })} /></div>
              <div><label className="label">Email</label><input required type="email" className="input" value={teach.email} onChange={(e) => setTeach({ ...teach, email: e.target.value })} /></div>
              <div><label className="label">Mobile number</label><input required className="input" value={teach.mobile} onChange={(e) => setTeach({ ...teach, mobile: e.target.value })} /></div>
              <div><label className="label">Subject you teach</label><select className="input" value={teach.subject} onChange={(e) => setTeach({ ...teach, subject: e.target.value })}>{["Mathematics", "Science", "Physics", "Chemistry", "Biology", "English", "Social Science", "Accounts", "Economics"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Experience (years)</label><input type="number" min="0" className="input" value={teach.experience_years} onChange={(e) => setTeach({ ...teach, experience_years: e.target.value })} placeholder="e.g. 5" /></div>
              <div><label className="label">Qualification</label><input className="input" value={teach.qualification} onChange={(e) => setTeach({ ...teach, qualification: e.target.value })} placeholder="e.g. B.Sc. Maths, B.Ed." /></div>
            </div>
            <button className="btn-brand mt-4 w-full">Send teacher request</button>
            {teachMsg && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm font-semibold text-brand-dark">{teachMsg}</p>}
          </form>
        </div>
      </section>

      {/* ENQUIRY */}
      <section id="demo" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-8 rounded-[28px] bg-gradient-to-br from-[#0b5f47] to-[#083f31] p-8 text-white md:grid-cols-2">
          <div><h2 className="text-3xl font-extrabold">Free demo class</h2><p className="mt-2 text-white/80">Sit in a real class. Then decide. Tell us the student’s class and board, and we’ll prepare an enquiry you can share with the academy office.</p>
          <ul className="mt-5 space-y-2 text-sm font-semibold"><li>✓ A full batch class — the real teachers, the real pace</li><li>✓ Student app account set up the same day</li><li>✓ Short level check, so the batch fit is right</li></ul></div>
          <form onSubmit={submitEnquiry} className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
            <h3 className="font-extrabold">Admission enquiry</h3><p className="text-sm text-slate-500">Fill this in — we’ll format it into a ready-to-send enquiry.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="label">Student name</label><input required className="input" value={enq.student_name} onChange={(e) => setEnq({ ...enq, student_name: e.target.value })} /></div>
              <div><label className="label">Parent mobile</label><input required className="input" value={enq.parent_mobile} onChange={(e) => setEnq({ ...enq, parent_mobile: e.target.value })} /></div>
              <div><label className="label">Class</label><select className="input" value={enq.class_label} onChange={(e) => setEnq({ ...enq, class_label: e.target.value })}>{["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Board</label><select className="input" value={enq.board} onChange={(e) => setEnq({ ...enq, board: e.target.value })}>{["CBSE", "ICSE", "State Board", "Other"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">Interested in</label><select className="input" value={enq.interested_in} onChange={(e) => setEnq({ ...enq, interested_in: e.target.value })}><option value="">Select a batch…</option>{batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}<option value="Not sure yet — guide me">Not sure yet — guide me</option></select></div>
              <div className="sm:col-span-2"><label className="label">Anything we should know? (optional)</label><textarea className="input" value={enq.notes} onChange={(e) => setEnq({ ...enq, notes: e.target.value })} /></div>
            </div>
            <button className="btn-brand mt-4 w-full">Prepare my enquiry</button>
            {enqMsg && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm font-semibold text-brand-dark">{enqMsg}</p>}
            {enqText && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">{enqText}</pre>}
          </form>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
