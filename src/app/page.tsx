"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import InstallAppButton from "@/components/InstallAppButton";

const COURSES = [
  { band: "6-8", name: "Foundation Builder", tag: "Classes 6–8 · Classroom", subs: ["Maths","Science","English","SST"], points: ["Concept-building with daily practice questions","Olympiad & NTSE-style thinking, gently introduced","Monthly parent review of progress"] },
  { band: "9-10", name: "Board Excellence", tag: "Classes 9–10 · Classroom + App", subs: ["Maths","Science","English","SST","IT"], points: ["Chapter tests after every chapter, unit tests monthly","Previous-year papers solved in class","Two full revision rounds before boards"] },
  { band: "11-12", name: "Senior Secondary — Science", tag: "Classes 11–12 · Classroom", subs: ["Physics","Chemistry","Maths","Biology"], points: ["Derivations and numericals practised daily","JEE / NEET-pattern MCQ drills every week","Personal doubt sessions after class"] },
  { band: "11-12", name: "Senior Secondary — Commerce", tag: "Classes 11–12 · Classroom", subs: ["Accounts","Economics","Business Studies","Maths"], points: ["Ledger-to-balance-sheet practice sets weekly","Case-study based Business Studies revision","Chapter-wise notes in the student app"] },
  { band: "6-10", name: "Revision Plus — Online", tag: "Classes 6–10 · Online", subs: ["Maths","Science","English"], points: ["Full recorded library, organised chapter-wise","Online test series with instant MCQ results","Weekend live doubt-clearing sessions"] },
  { band: "all", name: "Sunday Test Series", tag: "All classes · Test Series", subs: ["All subjects","Board pattern"], points: ["A board-pattern test every Sunday, checked by teachers","Marks and remarks visible to parents in the app","Weak-chapter list updated after every test"] },
];
const LECTURES = [
  { t: "Quadratic Equations — Introduction", s: "Maths · Chapter 4 · Notes attached", d: "24:10", st: "Done" },
  { t: "Pair of Linear Equations", s: "Maths · Chapter 3 · With practice sheet", d: "31:45", st: "Done" },
  { t: "Light — Reflection & Refraction", s: "Science · Chapter 10 · Resume at 16:20", d: "28:02", st: "68%" },
  { t: "Chemical Reactions & Equations", s: "Science · Chapter 1 · New", d: "22:37", st: "New" },
  { t: "Reported Speech — Rules & Practice", s: "English · Grammar · With worksheet", d: "18:54", st: "New" },
];
const QUIZ = [
  { q: "Q1 · Maths. The roots of x² − 5x + 6 = 0 are…", opts: ["1 and 6","2 and 3","−2 and −3"], ans: 1 },
  { q: "Q2 · Science. Which gas is released when zinc reacts with dilute hydrochloric acid?", opts: ["Oxygen","Carbon dioxide","Hydrogen"], ans: 2 },
  { q: "Q3 · Maths. The value of sin 30° is…", opts: ["1/2","√3/2","1"], ans: 0 },
];
const FAQS = [
  ["Which classes and boards does U++ Academy cover?","Classes 6 to 12, for CBSE, ICSE and State Board students. Classes 6–10 cover Maths, Science, English and Social Science; Classes 11–12 run Science (PCM / PCB) and Commerce streams."],
  ["What happens if my child misses a class?","The lecture appears in the student app with the teacher's notes, and any assignment set that day is listed with its deadline."],
  ["How do parents track progress?","Through the parent view of the app: attendance, test marks with teacher remarks, assignment status and fee records — plus a monthly summary."],
  ["Is the demo class really free?","Yes. The demo is a full, regular batch class so students experience the actual teaching, batch size and pace before any decision is made."],
  ["Can a student join only for the test series?","Yes — the Sunday Test Series and the Revision Plus online programme are open to students who are not in a full classroom batch."],
];

export default function Landing() {
  const [tab, setTab] = useState<"home"|"lectures"|"tests"|"progress">("home");
  const [lecFilter, setLecFilter] = useState("All");
  const [band, setBand] = useState("All");
  const [roleTab, setRoleTab] = useState<"student"|"parent"|"teacher">("student");
  const [answers, setAnswers] = useState<(number|null)[]>([null,null,null]);
  const [score, setScore] = useState<number|null>(null);
  const [enq, setEnq] = useState({ student_name:"", parent_mobile:"", class_label:"Class 10", board:"CBSE", interested_in:"Board Excellence (Classes 9–10)", notes:"" });
  const [enqMsg, setEnqMsg] = useState("");
  const [enqText, setEnqText] = useState("");
  const [teach, setTeach] = useState({ full_name:"", email:"", mobile:"", subject:"Mathematics", experience_years:"", qualification:"" });
  const [teachMsg, setTeachMsg] = useState("");

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
      setTeach({ full_name:"", email:"", mobile:"", subject:"Mathematics", experience_years:"", qualification:"" });
    } catch {
      setTeachMsg("Could not send your request — please check your connection and try again, or contact the academy office directly.");
    }
  }

  async function submitEnquiry(e: React.FormEvent) {
    e.preventDefault();
    const text = `Demo class enquiry — U++ Academy\nStudent: ${enq.student_name}\nParent mobile: ${enq.parent_mobile}\nClass: ${enq.class_label} · Board: ${enq.board}\nInterested in: ${enq.interested_in}\nNotes: ${enq.notes || "-"}`;
    setEnqText(text);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").insert(enq);
      setEnqMsg(error ? "Saved locally below — Supabase insert failed (check env vars / schema). Copy the enquiry and share it with the academy office." : "Enquiry saved. Copy it below and share it with the academy office to confirm your slot.");
    } catch {
      setEnqMsg("Supabase is not configured yet — copy the enquiry below and share it with the academy office.");
    }
  }

  return (
    <div>
      <header className="sticky top-0 z-50 border-b bg-[#f4f7f8]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg"><img src="/logo.jpg" alt="U++ Academy" className="h-10 w-10 rounded-xl object-cover" /><span>U++ Academy<small className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">Coaching · Classes 6–12</small></span></Link>
          <nav className="ml-auto hidden gap-1 md:flex">
            <a href="#courses" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Courses</a>
            <a href="#app" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Student App</a>
            <a href="#why" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Why U++</a>
            <a href="#teach" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Teach with us</a>
            <a href="#faq" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">FAQ</a>
          </nav>
          <Link href="/auth/login" className="btn-ghost !px-4 !py-2 text-sm">Login</Link>
          <Link href="/auth/register" className="btn-brand !px-4 !py-2 text-sm">Register</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-[#eaf1f0]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow"><span className="h-2 w-2 rounded-full bg-accent" />Admissions open — new batches for Classes 6 to 12</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Your marks,<br />levelled up. <span className="text-brand">U</span><span className="bg-accent/40">++</span></h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">U++ Academy pairs small, focused classroom batches with a student app that carries the whole day with you — live classes, recorded lectures, assignments, tests and results, with parents kept in the loop at every step.</p>
            <div className="mt-7 flex flex-wrap gap-3"><a href="#demo" className="btn-brand">Book a free demo class</a><a href="#courses" className="btn-ghost">Explore courses</a><InstallAppButton /></div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600"><li>✓ CBSE · ICSE · State Board</li><li>✓ Maths, Science, English &amp; more</li><li>✓ Offline batches + online revision</li></ul>
            <div className="mt-8 max-w-md rounded-2xl border bg-white p-4 shadow-sm"><b>Small batches, full attention</b><p className="text-sm text-slate-500">— every student is known by name. · Classes 6–12</p><p className="mt-2 text-sm">Assignment evaluated · Quadratic Equations · <b>18 / 20</b> · Attendance <b>92%</b> · Parent report sent for this month</p></div>
          </div>

          {/* Phone mockup */}
          <div id="app" className="flex justify-center">
            <div className="w-[340px] rounded-[48px] bg-slate-900 p-3 shadow-2xl">
              <div className="flex h-[620px] flex-col overflow-hidden rounded-[38px] bg-[#f7faf9]">
                <div className="flex justify-between px-5 pt-3 text-xs font-bold"><span>9:41</span><span>● ● ●</span></div>
                <div className="flex-1 overflow-y-auto px-4 pb-3">
                  {tab === "home" && (<>
                    <div className="mt-2 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand font-extrabold text-white">AS</span><div className="flex-1"><span className="block text-xs text-slate-500">Namaste,</span><b>Aarav Sharma · Class 10</b></div><span className="relative grid h-9 w-9 place-items-center rounded-xl border bg-white">🔔<span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] text-white">3</span></span></div>
                    <div className="mt-4 rounded-2xl bg-gradient-to-r from-brand to-brand-dark p-4 text-white"><span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-extrabold tracking-wider">● LIVE TODAY · 4:00 PM</span><h3 className="mt-2 font-bold">Mathematics — Quadratic Equations</h3><p className="text-xs opacity-80">Class 10 CBSE Batch · with recorded backup</p><button className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-brand-dark">Open classroom →</button></div>
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
                    <div className="mt-2 flex gap-2 overflow-x-auto">{["All","Maths","Science","English"].map(c => <button key={c} onClick={() => setLecFilter(c)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${lecFilter===c ? "bg-brand text-white" : "bg-white"}`}>{c}</button>)}</div>
                    <div className="mt-2 divide-y">{LECTURES.filter(l => lecFilter==="All" || l.s.includes(lecFilter)).map(l => <div key={l.t} className="flex gap-3 py-3"><span className="grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-brand-tint text-xl">▶</span><div className="min-w-0 flex-1"><b className="block text-[13px] leading-snug">{l.t}</b><span className="text-xs text-slate-500">{l.s} · {l.d}</span></div><span className="text-[11px] font-extrabold text-brand">{l.st}</span></div>)}</div>
                    <p className="text-xs text-slate-500">Missed a class? Every lecture lands here with notes, so revision never depends on memory.</p>
                  </>)}
                  {tab === "tests" && (<>
                    <h4 className="mt-3 text-sm font-extrabold">Practice test · Quick Check · Mixed Bag</h4>
                    <p className="text-xs text-slate-500">3 questions, just like the weekly tests in the app.</p>
                    {QUIZ.map((q, qi) => (
                      <div key={qi} className="mt-3 rounded-2xl border bg-white p-3"><p className="text-sm font-bold">{q.q}</p>
                        {q.opts.map((o, oi) => (
                          <button key={oi} onClick={() => { const a=[...answers]; a[qi]=oi; setAnswers(a); setScore(null); }} className={`mt-2 block w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold ${answers[qi]===oi ? "border-brand bg-brand-tint" : "bg-slate-50"}`}>{o}</button>
                        ))}
                      </div>
                    ))}
                    <button onClick={() => setScore(answers.filter((a,i)=>a===QUIZ[i].ans).length)} className="btn-brand mt-3 w-full !py-2.5 text-sm">Check answers</button>
                    {score !== null && <p className="mt-2 text-center font-extrabold text-brand">You scored {score} / 3 {score===3 ? "— excellent!" : "— keep practising."}</p>}
                  </>)}
                  {tab === "progress" && (<>
                    <h4 className="mt-3 text-sm font-extrabold">My report · Progress — This Term</h4>
                    <div className="mt-3 flex items-center gap-4 rounded-2xl border bg-white p-4"><span className="grid h-20 w-20 place-items-center rounded-full border-8 border-brand text-lg font-extrabold">92%</span><div><b>Attendance</b><p className="text-xs text-slate-500">46 of 50 classes attended this term. Parents see this same report.</p></div></div>
                    <h4 className="mb-2 mt-4 text-sm font-extrabold">Subject performance</h4>
                    {[["Mathematics",78],["Science",84],["English",71],["Social Science",88]].map(([s,v]) => <div key={s as string} className="mb-2"><div className="flex justify-between text-xs font-bold"><span>{s}</span><span className="text-brand">{v}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{width:`${v}%`}} /></div></div>)}
                    <h4 className="mb-2 mt-4 text-sm font-extrabold">Recent results</h4>
                    <div className="space-y-2 text-sm"><div className="rounded-2xl border bg-white p-3"><b>Unit Test — Polynomials</b><p className="text-xs text-slate-500">Maths · Marked by teacher with feedback</p><b className="text-brand">39 / 50</b></div><div className="rounded-2xl border bg-white p-3"><b>Assignment — Quadratic Equations</b><p className="text-xs text-slate-500">Evaluated · “Good method, watch signs in step 3”</p><b className="text-brand">18 / 20</b></div></div>
                  </>)}
                </div>
                <div className="grid grid-cols-4 border-t bg-white px-2 py-2 pb-4">
                  {(["home","lectures","tests","progress"] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-bold capitalize ${tab===t ? "text-brand" : "text-slate-400"}`}>{t==="home"?"🏠":t==="lectures"?"▶":t==="tests"?"✏":"📈"}{t}</button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-y bg-white"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-4 text-sm font-bold text-slate-600"><span>✓ Small batches, personal attention</span><span>✓ Every class recorded for revision</span><span>✓ Weekly tests, checked with feedback</span><span>✓ Parents updated every week</span></div></div>

      {/* COURSES */}
      <section id="courses" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Courses</p>
        <h2 className="mt-2 text-3xl font-extrabold">One academy, from Class 6 right up to boards</h2>
        <p className="mt-2 text-slate-600">Pick your class band. Every course includes classroom teaching, recorded lectures in the app, weekly tests and chapter-wise notes.</p>
        <div className="mt-6 flex flex-wrap gap-2">{["All","6-8","9-10","11-12"].map(b => <button key={b} onClick={() => setBand(b)} className={`rounded-full border px-4 py-2 text-sm font-bold ${band===b ? "bg-brand text-white" : "bg-white"}`}>{b==="All"?"All classes":`Classes ${b}`}</button>)}</div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {COURSES.filter(c => band==="All" || c.band===band || (band==="11-12" && c.band==="11-12")).map(c => (
            <article key={c.name} className="card flex flex-col">
              <span className="inline-block w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-extrabold text-white">{c.tag}</span>
              <h3 className="mt-3 text-xl font-extrabold">{c.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">{c.subs.map(s => <span key={s} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{s}</span>)}</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">{c.points.map(p => <li key={p}>✓ {p}</li>)}</ul>
              <a href="#demo" className="btn-brand mt-auto pt-3 !py-2.5 text-sm" style={{marginTop:16}}>Book free demo</a>
            </article>
          ))}
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="border-y bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Why U++</p>
          <h2 className="mt-2 text-3xl font-extrabold">A classroom that follows the student home</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Most tuition ends when the class ends. At U++ the learning continues in the app — and parents can see it happening.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Recorded lectures for every class","Absent, distracted, or revising the night before a test — every lesson is in the app, organised Class → Subject → Chapter, with the teacher's notes attached."],
              ["Small batches, known by name","Batch sizes stay small on purpose. Teachers know who is quiet, who is rushing, and who needs one more example."],
              ["Tests that teach","Weekly tests are returned with marks and remarks — what went wrong, and which chapter to reopen."],
              ["Doubts never wait","Ask a doubt from the app any evening — photo of the question is enough. Teachers answer and close it as resolved."],
              ["Parents in the loop","Attendance, marks, pending homework and fee status — parents see the same picture the teachers see."],
              ["One app, three views","Built for students, parents and teachers. Everyone signs in to the same academy — what they see is shaped for them."],
            ].map(([h,p]) => <div key={h} className="card"><h3 className="font-extrabold">{h}</h3><p className="mt-2 text-sm text-slate-600">{p}</p></div>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">{(["student","parent","teacher"] as const).map(r => <button key={r} onClick={() => setRoleTab(r)} className={`rounded-full border px-4 py-2 text-sm font-bold capitalize ${roleTab===r ? "bg-brand text-white" : "bg-white"}`}>For {r}s</button>)}</div>
          <div className="card mt-4">
            {roleTab==="student" && <><h3 className="text-lg font-extrabold">The student’s whole school day, after school</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>✓ Today’s classes and one-tap join for live sessions</li><li>✓ Assignments with deadlines, submitted by photo or PDF</li><li>✓ Marks, remarks and a weak-chapter list that updates itself</li><li>✓ Ask-a-doubt chat with your own teachers</li></ul></>}
            {roleTab==="parent" && <><h3 className="text-lg font-extrabold">No more “how was tuition today?”</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>✓ Attendance percentage and absence alerts</li><li>✓ Every test result with the teacher’s remarks</li><li>✓ Pending assignments at a glance</li><li>✓ Fee status and receipts in one place</li></ul></>}
            {roleTab==="teacher" && <><h3 className="text-lg font-extrabold">Teachers teach. The app does the paperwork.</h3><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>✓ Create batches and publish lectures in minutes</li><li>✓ Mark attendance once — parents are informed automatically</li><li>✓ Evaluate submissions with marks and feedback inline</li><li>✓ Announcements to a batch, a subject, or parents only</li></ul></>}
          </div>
        </div>
      </section>

      {/* STEPS + FAQ */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold">Joining U++ takes one visit</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[["1","Book a free demo class","Fill the enquiry below and pick a day. Your child attends a real batch class — not a sales presentation — and meets the teachers."],["2","Get placed in the right batch","After the demo, we place the student by class, board and current level, and set up their app account with the batch timetable."],["3","Learn, test, improve — visibly","Lectures, homework, tests and reports start flowing into the app from day one, so progress is something you can see, not guess."]].map(([n,h,p]) => <div key={n} className="card"><span className="grid h-11 w-11 place-items-center rounded-full bg-brand font-extrabold text-white">{n}</span><h3 className="mt-3 font-extrabold">{h}</h3><p className="mt-1 text-sm text-slate-600">{p}</p></div>)}
        </div>
        <h2 id="faq" className="mt-14 text-center text-3xl font-extrabold">Parents usually ask us…</h2>
        <div className="mx-auto mt-6 max-w-3xl space-y-3">{FAQS.map(([q,a]) => <details key={q} className="card !p-4"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-2 text-sm text-slate-600">{a}</p></details>)}</div>
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
              <div><label className="label">Full name</label><input required className="input" value={teach.full_name} onChange={e=>setTeach({...teach,full_name:e.target.value})} /></div>
              <div><label className="label">Email</label><input required type="email" className="input" value={teach.email} onChange={e=>setTeach({...teach,email:e.target.value})} /></div>
              <div><label className="label">Mobile number</label><input required className="input" value={teach.mobile} onChange={e=>setTeach({...teach,mobile:e.target.value})} /></div>
              <div><label className="label">Subject you teach</label><select className="input" value={teach.subject} onChange={e=>setTeach({...teach,subject:e.target.value})}>{["Mathematics","Science","Physics","Chemistry","Biology","English","Social Science","Accounts","Economics"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Experience (years)</label><input type="number" min="0" className="input" value={teach.experience_years} onChange={e=>setTeach({...teach,experience_years:e.target.value})} placeholder="e.g. 5" /></div>
              <div><label className="label">Qualification</label><input className="input" value={teach.qualification} onChange={e=>setTeach({...teach,qualification:e.target.value})} placeholder="e.g. B.Sc. Maths, B.Ed." /></div>
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
            <h3 className="font-extrabold">Demo class enquiry</h3><p className="text-sm text-slate-500">Fill this in — we’ll format it into a ready-to-send enquiry.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="label">Student name</label><input required className="input" value={enq.student_name} onChange={e=>setEnq({...enq,student_name:e.target.value})} /></div>
              <div><label className="label">Parent mobile</label><input required className="input" value={enq.parent_mobile} onChange={e=>setEnq({...enq,parent_mobile:e.target.value})} /></div>
              <div><label className="label">Class</label><select className="input" value={enq.class_label} onChange={e=>setEnq({...enq,class_label:e.target.value})}>{["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Board</label><select className="input" value={enq.board} onChange={e=>setEnq({...enq,board:e.target.value})}>{["CBSE","ICSE","State Board","Other"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">Interested in</label><select className="input" value={enq.interested_in} onChange={e=>setEnq({...enq,interested_in:e.target.value})}>{COURSES.map(c=><option key={c.name}>{c.name} ({c.tag})</option>)}<option>Not sure yet — guide me</option></select></div>
              <div className="sm:col-span-2"><label className="label">Anything we should know? (optional)</label><textarea className="input" value={enq.notes} onChange={e=>setEnq({...enq,notes:e.target.value})} /></div>
            </div>
            <button className="btn-brand mt-4 w-full">Prepare my enquiry</button>
            {enqMsg && <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm font-semibold text-brand-dark">{enqMsg}</p>}
            {enqText && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">{enqText}</pre>}
          </form>
        </div>
      </section>
      <footer className="border-t bg-white py-8 text-center text-sm text-slate-500"><img src="/logo.jpg" alt="U++ Academy" className="mx-auto mb-3 h-14 w-14 rounded-2xl object-cover" />U++ Academy — Teach smarter. Learn better. Level up, one class at a time. · Coaching · Classes 6–12</footer>
    </div>
  );
}
