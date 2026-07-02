import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://invesutra.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/dashboard", priority: 0.5, changeFrequency: "daily" as const },
    { path: "/screener", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/simulator", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/reports", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/auth/login", priority: 0.3, changeFrequency: "monthly" as const },
    { path: "/auth/signup", priority: 0.4, changeFrequency: "monthly" as const },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
