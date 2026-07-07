import Link from "next/link";
import { TrendingUp } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-white text-sm">Invesutra</span>
            </Link>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              AI-powered portfolio analysis and decision-support platform. Not a SEBI-registered investment advisor.
            </p>
          </div>

          <div className="flex gap-12">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Product</p>
              <div className="space-y-2">
                {["Dashboard", "Screener", "Simulator", "Pricing"].map(l => (
                  <Link key={l} href={`/${l.toLowerCase()}`} className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Legal</p>
              <div className="space-y-2">
                {["Privacy Policy", "Terms of Service", "Disclaimer"].map(l => (
                  <Link key={l} href="#" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">{l}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Invesutra. All rights reserved.</p>
          <p className="text-xs text-slate-600">
            For informational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
