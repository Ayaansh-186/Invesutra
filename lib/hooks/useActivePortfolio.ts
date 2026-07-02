"use client";

import { useEffect, useState, useCallback } from "react";
import type { Portfolio } from "@/lib/types";
import { SAMPLE_PORTFOLIO } from "@/lib/utils/mockData";
import { useAuth } from "./useAuth";

export interface UsePortfolioResult {
  portfolio: Portfolio;
  loading: boolean;
  isDemo: boolean;       // true only when NOT signed in
  isEmpty: boolean;      // true when signed in but no portfolios yet
  error: string | null;
  refresh: () => Promise<void>;
}

export function useActivePortfolio(): UsePortfolioResult {
  const { user, loading: authLoading } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio>(SAMPLE_PORTFOLIO);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (authLoading) return;

    // Not signed in → pure demo mode
    if (!user) {
      setPortfolio(SAMPLE_PORTFOLIO);
      setIsDemo(true);
      setIsEmpty(false);
      setLoading(false);
      return;
    }

    // Signed in → try to load their portfolios
    setLoading(true);
    setError(null);
    setIsDemo(false); // They ARE signed in — never show "create account" banner

    try {
      const res = await fetch("/api/portfolios");
      const data = await res.json();

      if (!res.ok) {
        // DB error (tables not set up, etc.) — show demo data but DON'T say "create account"
        console.warn("Portfolio API error:", data.error);
        setPortfolio(SAMPLE_PORTFOLIO);
        setIsEmpty(true);
        setLoading(false);
        return;
      }

      const portfolios: Portfolio[] = data.portfolios || [];

      if (portfolios.length === 0) {
        // Signed in, DB works, but no portfolios created yet
        setPortfolio(SAMPLE_PORTFOLIO);
        setIsEmpty(true);
      } else {
        setPortfolio(portfolios[0]);
        setIsEmpty(false);
      }
    } catch (err) {
      console.error("Failed to load portfolio:", err);
      setPortfolio(SAMPLE_PORTFOLIO);
      setIsEmpty(true);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  return { portfolio, loading, isDemo, isEmpty, error, refresh: load };
}
