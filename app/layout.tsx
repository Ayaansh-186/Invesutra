import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { isIndexingEnabled, siteUrl } from "@/lib/seo";

// Self-hosts Inter and inlines the @font-face at build time instead of
// fetching from fonts.googleapis.com at request time — removes a
// third-party network round-trip from every page load.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Invesutra | Mutual Fund Portfolio Intelligence",
    template: "%s | Invesutra",
  },
  description:
    "Understand, analyze, and rebalance Indian mutual fund portfolios with clear portfolio insights and the QuantRebalance Protocol.",
  keywords: [
    "AI mutual fund screener",
    "AI portfolio analyzer",
    "wealth management AI",
    "investment analytics",
    "mutual fund analysis",
    "portfolio rebalancing",
    "QuantRebalance Protocol",
    "Indian mutual funds",
    "SIP analysis",
    "portfolio health score",
  ],
  authors: [{ name: "Invesutra" }],
  creator: "Invesutra",
  publisher: "Invesutra",
  applicationName: "Invesutra",
  category: "finance",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Invesutra",
    title: "Invesutra | Mutual Fund Portfolio Intelligence",
    description:
      "Understand, analyze, and rebalance Indian mutual fund portfolios with clearer insights.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Invesutra | Mutual Fund Portfolio Intelligence",
    description:
      "Understand, analyze, and rebalance Indian mutual fund portfolios with clearer insights.",
  },
  robots: {
    index: isIndexingEnabled,
    follow: isIndexingEnabled,
    noarchive: !isIndexingEnabled,
    googleBot: {
      index: isIndexingEnabled,
      follow: isIndexingEnabled,
      noimageindex: !isIndexingEnabled,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: { icon: "/invesutra-mark.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Set the theme class before paint so there's no flash of the
            wrong theme. Runs synchronously; defaults to system preference
            the first time a visitor arrives. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('invesutra-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased bg-[var(--bg)] text-[var(--fg)] min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
