"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { TrendingUp, Menu, X, Sparkles, ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/shared/ThemeToggle";

const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isDark = !scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/30 transition-shadow">
            <TrendingUp className="w-4 h-4 text-slate-950" strokeWidth={2.5} />
          </div>
          <span className={`font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            Invesutra
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle className="bg-white/5! border-white/10! text-slate-300! hover:text-white!" />
          <Link
            href="/auth/login"
            className={`text-sm font-medium transition-colors ${
              isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="group flex items-center gap-1.5 px-4 py-2 bg-cyan-300 text-slate-950 text-sm font-semibold rounded-lg hover:bg-cyan-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Talk to AI
            <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`md:hidden p-2 rounded-md ${isDark ? "text-white" : "text-slate-600"}`}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#07111f] border-t border-white/10 px-6 py-4 space-y-3">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-sm text-slate-300 font-medium py-1"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 mt-3 px-4 py-2.5 bg-cyan-300 text-slate-950 text-sm font-semibold rounded-lg"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Talk to AI
          </Link>
        </div>
      )}
    </header>
  );
}
