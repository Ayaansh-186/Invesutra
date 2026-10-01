import type { FundSearchResult } from "./types";
import { isRecentNav } from "./navFreshness";

function normalizeFundName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(plan|option)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findExactLiveFund(name: string, matches: FundSearchResult[], now = new Date()): FundSearchResult | undefined {
  const target = normalizeFundName(name);
  if (!target) return undefined;
  const exact = matches.filter((candidate) =>
    candidate.dataQuality === "live" &&
    candidate.nav !== undefined &&
    Number.isFinite(candidate.nav) &&
    candidate.nav > 0 &&
    isRecentNav(candidate.asOf, now) &&
    normalizeFundName(candidate.name) === target
  );
  return exact.length === 1 ? exact[0] : undefined;
}
