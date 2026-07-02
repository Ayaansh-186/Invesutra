import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://invesutra.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/screener", "/simulator", "/reports", "/auth/callback"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
