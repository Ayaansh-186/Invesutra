"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { useAuth } from "@/lib/hooks/useAuth";
import AIPortfolioAssistant from "@/components/dashboard/AIPortfolioAssistant";
import AddFundModal from "@/components/dashboard/AddFundModal";
import { Sparkles, CheckCircle2, Plus } from "lucide-react";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const { user } = useAuth();
  const { portfolio, loading, isDemo, isEmpty, refresh } = useActivePortfolio();
  const [showAddFund, setShowAddFund] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const analysis = portfolio.analysis ?? riskEngine.analyzePortfolio(portfolio);
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || undefined;

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-cyan-400" />
        </div>
        <p className="text-sm text-[var(--shell-text-muted)]">Invesutra AI is loading your portfolio...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Status banners */}
      {isDemo && !user && (
        <div className="shrink-0 flex items-center gap-3 border-b border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
          <p className="flex-1 text-xs text-[var(--shell-text-muted)]">
            Exploring with sample data.{" "}
            <Link href="/auth/signup" className="font-semibold text-cyan-300 hover:underline">
              Sign up free
            </Link>{" "}
            to add your real holdings.
          </p>
        </div>
      )}
      {isEmpty && user && (
        <div className="shrink-0 flex items-center gap-3 border-b border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="flex-1 text-xs text-[var(--shell-text-muted)]">
            Welcome! Ask Invesutra to help you add your first fund, or click Add Fund.
          </p>
          <button
            onClick={() => setShowAddFund(true)}
            className="flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1 text-xs font-semibold text-slate-950"
          >
            <Plus className="h-3 w-3" />
            Add fund
          </button>
        </div>
      )}

      {/* Main AI-first layout — full width now that Portfolio has its own page */}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <AIPortfolioAssistant
          portfolio={portfolio}
          analysis={analysis}
          onAddFund={() => setShowAddFund(true)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          initialQuery={initialQuery}
          historyEnabled={!isDemo && !isEmpty}
        />
      </div>

      {showAddFund && (
        <AddFundModal
          portfolioId={!isDemo && !isEmpty ? portfolio.id : user ? "needs-portfolio" : null}
          onClose={() => setShowAddFund(false)}
          onAdded={() => {
            setShowAddFund(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
