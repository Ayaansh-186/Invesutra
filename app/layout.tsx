import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-white text-slate-900 min-h-screen">{children}</body>
    </html>
  );
}
