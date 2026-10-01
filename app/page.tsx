import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search, SlidersHorizontal, MessageSquareText } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Invesutra",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Mutual fund portfolio analysis and rebalancing tools for Indian investors.",
};

const steps = [
  {
    icon: Search,
    title: "Find the right funds",
    description: "Explore mutual funds with the details that matter, all in one place.",
  },
  {
    icon: SlidersHorizontal,
    title: "Understand your portfolio",
    description: "See allocation, overlap, and risk before deciding what to change.",
  },
  {
    icon: MessageSquareText,
    title: "Ask better questions",
    description: "Get clear, practical context from your portfolio assistant.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Navbar />

      <section className="relative isolate flex min-h-[min(76svh,700px)] items-center overflow-hidden bg-[#102820] px-6 pb-20 pt-36 text-white sm:pb-24 sm:pt-40">
        <Image
          src="/invesutra-mark.png"
          alt=""
          width={760}
          height={760}
          priority
          className="pointer-events-none absolute -right-24 bottom-[-15%] -z-10 w-[min(95vw,760px)] opacity-20 sm:right-[-3%] sm:bottom-[-35%] sm:w-[min(66vw,760px)] sm:opacity-35"
        />
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <p className="mb-6 text-sm font-medium text-emerald-200">A clearer view of your investments</p>
            <h1 className="text-5xl font-semibold leading-tight sm:text-6xl lg:text-7xl">Invesutra</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200 sm:text-xl">
              Understand your mutual funds, explore opportunities, and make portfolio decisions with more confidence.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/dashboard"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#b9e9cb] px-5 text-sm font-semibold text-[#102820] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Open dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="text-sm font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-emerald-800">What you can do</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Good decisions start with clarity.</h2>
          </div>
          <div className="mt-12 grid gap-10 border-t border-slate-200 pt-10 md:grid-cols-3 md:gap-12">
            {steps.map(({ icon: Icon, title, description }) => (
              <div key={title}>
                <Icon className="h-6 w-6 text-emerald-700" strokeWidth={1.7} aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
