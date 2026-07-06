import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/ThemeProvider";

// Self-hosts Inter and inlines the @font-face at build time instead of
// fetching from fonts.googleapis.com at request time — removes a
// third-party network round-trip from every page load.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://invesutra.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Invesutra — AI-Powered Mutual Fund Portfolio Intelligence",
    template: "%s | Invesutra",
  },
  description:
    "Screen, analyze, and optimize your mutual fund portfolio with AI-powered insights and the QuantRebalance Protocol. AI-powered intelligence for smarter wealth decisions.",
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
  applicationName: "Invesutra",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "Invesutra",
    title: "Invesutra — AI-Powered Portfolio Intelligence",
    description: "Screen, analyze, and optimize your mutual fund portfolio with intelligent algorithms and AI insights.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Invesutra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invesutra",
    description: "AI-powered intelligence for smarter wealth decisions.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: { icon: "/favicon.ico" },
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
