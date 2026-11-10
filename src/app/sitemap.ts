import type { MetadataRoute } from "next";

const BASE = "https://u-academy-zeta.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/about",
    "/coaching-in-mayurhand",
    "/coaching-in-chouparan",
    "/coaching-in-madhyagopali",
    "/privacy-policy",
    "/terms-and-conditions",
  ];
  return pages.map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date("2026-11-10"),
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p.startsWith("/coaching-in-") ? 0.8 : 0.6,
  }));
}
