"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "How it works", href: "#how-it-works" },
];

export default function Navbar({ alwaysLight = false }: { alwaysLight?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isDark = !alwaysLight && !scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || alwaysLight
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image src="/invesutra-mark.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
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
            className="group flex items-center gap-1.5 px-4 py-2 bg-[#b9e9cb] text-[#102820] text-sm font-semibold rounded-md hover:bg-emerald-100 transition-colors"
          >
            Open dashboard
            <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`md:hidden p-2 rounded-md ${isDark ? "text-white" : "text-slate-600"}`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#102820] border-t border-white/10 px-6 py-4 space-y-3">
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
            href="/auth/login"
            className="block py-1 text-sm font-medium text-slate-300"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 mt-3 px-4 py-2.5 bg-[#b9e9cb] text-[#102820] text-sm font-semibold rounded-md"
            onClick={() => setOpen(false)}
          >
            Open dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </header>
  );
}
