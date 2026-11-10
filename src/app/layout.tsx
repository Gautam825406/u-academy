import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL("https://u-academy-zeta.vercel.app"),
  title: "U++ Academy — Coaching Classes in Mayurhand, Chouparan & Madhyagopali | Classes 6–12",
  description:
    "U++ Academy — Build a Strong Academic Future. Quality education, expert academic guidance, and smart digital learning for students from Class 6 to Class 12. Online and offline classes, all boards, all major subjects. Serving Mayurhand, Chouparan, Madhyagopali and nearby areas of Jharkhand. Director: Umesh Kumar. Learn. Practice. Achieve.",
  keywords: [
    "coaching classes in Mayurhand",
    "tuition classes in Mayurhand",
    "coaching institute in Chouparan",
    "Class 6–12 tuition in Chouparan",
    "coaching in Madhyagopali",
    "Class 10 coaching",
    "Class 12 coaching",
    "online tuition in Jharkhand",
    "digital learning for school students",
    "U++ Academy",
  ],
  alternates: { canonical: "https://u-academy-zeta.vercel.app" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "U++ Academy — Build a Strong Academic Future",
    description:
      "Quality education, expert academic guidance, and smart digital learning for students from Class 6 to Class 12. Online and offline classes in Mayurhand, Chouparan and Madhyagopali, Jharkhand.",
    url: "https://u-academy-zeta.vercel.app",
    siteName: "U++ Academy",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/logo.jpg", width: 1254, height: 1254, alt: "U++ Academy — Learn. Practice. Achieve." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "U++ Academy — Build a Strong Academic Future",
    description:
      "Quality education for Classes 6–12. Online and offline classes in Mayurhand, Chouparan and Madhyagopali, Jharkhand.",
    images: ["/logo.jpg"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "U++ Academy", statusBarStyle: "default" },
  icons: { icon: "/logo.png", apple: "/apple-touch-icon.png", shortcut: "/logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07573f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="U++ Academy" />
      </head>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
