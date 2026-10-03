"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { useAuth } from "@/lib/hooks/useAuth";
import AIPortfolioAssistant from "@/components/dashboard/AIPortfolioAssistant";
import { Sparkles, Plus, AlertTriangle, Loader2 } from "lucide-react";

// Only pulled in when the user actually opens "Add Fund".
const AddFundModal = dynamic(() => import("@/components/dashboard/AddFundModal"), { ssr: false });

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const { user } = useAuth();
  const { portfolio, loading, isDemo, isEmpty, error, refresh } = useActivePortfolio();
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
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        <p className="text-sm text-[var(--shell-text-muted)]">
          Loading your holdings...
        </p>
      </div>
    );
  }

  if (user && ((error && !portfolio.funds.length) || isEmpty)) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-md text-center">
          {error ? <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" /> : <Plus className="mx-auto h-8 w-8 text-emerald-500" />}
          <h1 className="mt-5 text-xl font-semibold text-[var(--shell-text)]">
            {error ? "Portfolio unavailable" : "Start with your first fund"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--shell-text-muted)]">
            {error || "Add a holding to see a useful overview and ask questions about your own portfolio."}
          </p>
          <button
            onClick={error ? handleRefresh : () => setShowAddFund(true)}
            disabled={refreshing}
            className="app-primary-button mt-6"
          >
            {error ? "Try again" : "Add a fund"}
          </button>
        </div>
        {showAddFund && !error && (
          <AddFundModal
            portfolioId={portfolio.id || "needs-portfolio"}
            onClose={() => setShowAddFund(false)}
            onAdded={() => { setShowAddFund(false); void refresh(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Demo sessions stay clearly separate from a user's saved holdings. */}
      {isDemo && !user && (
        <div className="shrink-0 flex items-center gap-3 border-b border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
          <p className="flex-1 text-xs text-[var(--shell-text-muted)]">
            Exploring with sample data.{" "}
            <Link href="/auth/signup" className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300">
              Sign up free
            </Link>{" "}
            to add your real holdings.
          </p>
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
          portfolioId={!isDemo && portfolio.id ? portfolio.id : user ? "needs-portfolio" : null}
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
