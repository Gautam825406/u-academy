import type { Metadata } from "next";
import LocationPage from "@/components/LocationPage";

export const metadata: Metadata = {
  title: "Coaching Classes in Mayurhand | Class 6–12 Tuition — U++ Academy",
  description:
    "Coaching and tuition classes in Mayurhand, Jharkhand for students of Classes 6 to 12 — all boards, all major subjects, offline classroom and online digital learning at U++ Academy.",
  alternates: { canonical: "https://u-academy-zeta.vercel.app/coaching-in-mayurhand" },
  openGraph: {
    title: "Coaching Classes in Mayurhand | U++ Academy",
    description:
      "Class 6–12 coaching in Mayurhand — all boards, all major subjects, online and offline learning.",
    url: "https://u-academy-zeta.vercel.app/coaching-in-mayurhand",
    type: "website",
  },
};

export default function Page() {
  return (
    <LocationPage
      loc={{
        slug: "mayurhand",
        name: "Mayurhand",
        intro:
          "U++ Academy provides coaching and tuition for students in Mayurhand, Jharkhand — Classes 6 to 12, all school boards, all major school subjects. Students learn in offline classroom batches and through the academy's online student app, with live classes, recorded lectures, tests and progress tracking.",
        why: [
          "Small batches where teachers know every student by name.",
          "Recorded lectures for every class, so missed lessons and revision are never a problem.",
          "Weekly tests with marks and teacher feedback, and parents kept in the loop.",
          "One app for classes, homework, tests, attendance and doubt-solving.",
        ],
        nearby:
          "Students from Mayurhand and surrounding villages in the area can join classroom batches or learn online through the student app — the same teachers, the same tests, and the same progress reports either way.",
      }}
    />
  );
}
