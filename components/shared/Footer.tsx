import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#102820] border-t border-white/10 py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Image src="/invesutra-mark.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              <span className="font-semibold text-white text-sm">Invesutra</span>
            </Link>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              AI-powered portfolio analysis and decision-support platform. Not a SEBI-registered investment advisor.
            </p>
          </div>

          <Link href="/dashboard" className="text-sm font-medium text-emerald-100 hover:text-white">Open dashboard</Link>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Invesutra. All rights reserved.</p>
          <p className="text-xs text-slate-600">
            For informational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
