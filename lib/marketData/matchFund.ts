import type { FundSearchResult } from "./types";

function normalizeFundName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(plan|option)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findExactLiveFund(name: string, matches: FundSearchResult[]): FundSearchResult | undefined {
  const target = normalizeFundName(name);
  if (!target) return undefined;
  return matches.find((candidate) =>
    candidate.dataQuality === "live" &&
    candidate.nav !== undefined &&
    Number.isFinite(candidate.nav) &&
    candidate.nav > 0 &&
    normalizeFundName(candidate.name) === target
  );
}
