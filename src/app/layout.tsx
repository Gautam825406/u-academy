import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "U++ Academy — Learn Smarter, Every Day",
  description: "Tuition and coaching for Classes 6–12 with live classes, recorded lectures, weekly tests and parent progress updates, all in one student app.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
