import type { Metadata } from "next";

const FALLBACK_SITE_URL = "http://localhost:3000";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL,
);

export const isIndexingEnabled =
  process.env.NEXT_PUBLIC_SEO_INDEXING === "true";

export const privatePageRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};
