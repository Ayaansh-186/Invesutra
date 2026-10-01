import type { MetadataRoute } from "next";
import { isIndexingEnabled, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexingEnabled) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/portfolio",
        "/reports",
        "/screener",
        "/simulator",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
