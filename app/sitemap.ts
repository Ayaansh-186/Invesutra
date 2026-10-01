import type { MetadataRoute } from "next";
import { isIndexingEnabled, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexingEnabled) return [];

  return [
    {
      url: siteUrl.toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
