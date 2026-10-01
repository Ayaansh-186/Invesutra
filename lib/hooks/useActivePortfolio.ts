"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Portfolio } from "@/lib/types";
import { SAMPLE_PORTFOLIO } from "@/lib/utils/mockData";
import { useAuth } from "./useAuth";

const EMPTY_PORTFOLIO: Portfolio = {
  ...SAMPLE_PORTFOLIO,
  id: "",
  userId: "",
  name: "My Portfolio",
  funds: [],
  totalInvested: 0,
  currentValue: 0,
  returns: 0,
  returnsPercent: 0,
  healthScore: 0,
  riskScore: 0,
  analysis: undefined,
};

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
  const requestSequence = useRef(0);
  const lastLoad = useRef(0);

  const load = useCallback(async (background = false) => {
    if (authLoading) return;
    const sequence = ++requestSequence.current;

    // Not signed in → pure demo mode
    if (!user) {
      setPortfolio(SAMPLE_PORTFOLIO);
      setIsDemo(true);
      setIsEmpty(false);
      setLoading(false);
      return;
    }

    // Signed in → try to load their portfolios
    if (!background) setLoading(true);
    setError(null);
    setIsDemo(false); // They ARE signed in — never show "create account" banner

    try {
      const res = await fetch("/api/portfolios", { cache: "no-store", signal: AbortSignal.timeout(45_000) });
      const data = await res.json();
      if (sequence !== requestSequence.current) return;
      lastLoad.current = Date.now();

      if (!res.ok) {
        // A signed-in user's holdings must never be replaced with demo figures.
        console.warn("Portfolio API error:", data.error);
        setError(data.error || "Could not load your saved portfolio.");
        setPortfolio(EMPTY_PORTFOLIO);
        setIsEmpty(true);
        setLoading(false);
        return;
      }

      const portfolios: Portfolio[] = data.portfolios || [];

      if (portfolios.length === 0) {
        // Signed in, DB works, but no portfolios created yet
        setPortfolio(EMPTY_PORTFOLIO);
        setIsEmpty(true);
      } else {
        setPortfolio(portfolios[0]);
        setIsEmpty(portfolios[0].funds.length === 0);
      }
    } catch (err) {
      if (sequence !== requestSequence.current) return;
      console.error("Failed to load portfolio:", err);
      setError("Could not reach the portfolio service. Please try again.");
      setPortfolio(EMPTY_PORTFOLIO);
      setIsEmpty(true);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!user || authLoading) return;
    const reload = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > 60_000) void load(true);
    };
    const timer = window.setInterval(reload, 15 * 60 * 1000);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [user, authLoading, load]);

  return { portfolio, loading, isDemo, isEmpty, error, refresh: () => load(true) };
}
