import type { Metadata } from "next";
import LocationPage from "@/components/LocationPage";

export const metadata: Metadata = {
  title: "Coaching in Madhyagopali | Class 6–12 Tuition — U++ Academy",
  description:
    "Coaching and tuition in Madhyagopali, Jharkhand for students of Classes 6 to 12 — all boards, all major subjects, offline classroom and online digital learning at U++ Academy.",
  alternates: { canonical: "https://u-academy-zeta.vercel.app/coaching-in-madhyagopali" },
  openGraph: {
    title: "Coaching in Madhyagopali | U++ Academy",
    description:
      "Class 6–12 coaching in Madhyagopali — all boards, all major subjects, online and offline learning.",
    url: "https://u-academy-zeta.vercel.app/coaching-in-madhyagopali",
    type: "website",
  },
};

export default function Page() {
  return (
    <LocationPage
      loc={{
        slug: "madhyagopali",
        name: "Madhyagopali",
        intro:
          "U++ Academy provides coaching and tuition for students in Madhyagopali, Jharkhand — Classes 6 to 12, all school boards, all major school subjects. Students learn in offline classroom batches and through the academy's online student app, with live classes, recorded lectures, tests and progress tracking.",
        why: [
          "Concept-based teaching with daily practice, not rote learning.",
          "Doubts answered the same evening through the app's doubt discussion.",
          "Regular tests and assignments that show exactly which chapters need more work.",
          "A free demo class before joining, so families can see the teaching first.",
        ],
        nearby:
          "Students from Madhyagopali and nearby areas can join classroom batches or learn online through the student app — the same teachers, the same tests, and the same progress reports either way.",
      }}
    />
  );
}
