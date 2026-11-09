import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "U++ Academy — Learn Smarter, Every Day",
  description: "Tuition and coaching for Classes 6–12 with live classes, recorded lectures, weekly tests and parent progress updates, all in one student app.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "U++ Academy", statusBarStyle: "default" },
  icons: { icon: "/icon-512.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#07573f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.webmanifest" />
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
