import type { Metadata } from "next";
import LocationPage from "@/components/LocationPage";

export const metadata: Metadata = {
  title: "Coaching Institute in Chouparan | Class 6–12 Tuition — U++ Academy",
  description:
    "Coaching institute in Chouparan, Jharkhand for students of Classes 6 to 12 — all boards, all major subjects, offline classroom and online digital learning at U++ Academy.",
  alternates: { canonical: "https://u-academy-zeta.vercel.app/coaching-in-chouparan" },
  openGraph: {
    title: "Coaching Institute in Chouparan | U++ Academy",
    description:
      "Class 6–12 tuition in Chouparan — all boards, all major subjects, online and offline learning.",
    url: "https://u-academy-zeta.vercel.app/coaching-in-chouparan",
    type: "website",
  },
};

export default function Page() {
  return (
    <LocationPage
      loc={{
        slug: "chouparan",
        name: "Chouparan",
        intro:
          "U++ Academy provides coaching and tuition for students in Chouparan, Jharkhand — Classes 6 to 12, all school boards, all major school subjects. Students learn in offline classroom batches and through the academy's online student app, with live classes, recorded lectures, tests and progress tracking.",
        why: [
          "Structured academic learning — chapter tests, unit tests and full revision before board examinations.",
          "Small batches with personal attention and regular doubt-solving.",
          "Recorded lectures and study materials in the student app, organised by class and subject.",
          "Parents can follow attendance, test marks and fee records from the app.",
        ],
        nearby:
          "Students from Chouparan and nearby areas can join classroom batches or learn online through the student app. Class 10 and Class 12 students get board-focused preparation with previous-pattern tests and revision rounds.",
      }}
    />
  );
}
