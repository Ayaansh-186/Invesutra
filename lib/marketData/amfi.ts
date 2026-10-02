import { isRecentNav, navDateToIso } from "./navFreshness";
import type { FundSearchFilters } from "./types";

export const AMFI_NAV_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

export interface AmfiScheme {
  schemeCode: string;
  name: string;
  fundHouse: string;
  category: string;
  schemeType: string;
  planType: "direct" | "regular" | "unknown";
  optionType: "growth" | "idcw" | "unknown";
  isin?: string;
  nav: number;
  navAsOf: string;
}

export function isExchangeTradedFund(name: string): boolean {
  return /\betf\b|exchange[ -]traded/i.test(name) && !/fund[ -]of[ -]fund|\bfof\b/i.test(name);
}

export function parseAmfiNav(text: string): AmfiScheme[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headers = lines[0]?.split(";").map((header) => header.trim().toLowerCase()) || [];
  const index = (header: string) => headers.indexOf(header);
  const codeIndex = index("scheme code");
  const nameIndex = index("scheme name");
  const navIndex = index("net asset value");
  const dateIndex = index("date");
  if ([codeIndex, nameIndex, navIndex, dateIndex].some((value) => value < 0)) throw new Error("AMFI NAV file has an unsupported header");
  const planIndex = index("plan");
  const optionIndex = index("option");
  const isinIndex = headers.findIndex((header) => header.includes("isin") && header.includes("growth"));
  let fundHouse = "";
  let category = "";
  let schemeType = "";
  const schemes = new Map<string, AmfiScheme>();

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.includes(";")) {
      const group = /^(Open Ended Schemes|Close Ended Schemes|Closed Ended Schemes|Interval Fund Schemes)\s*\((.*)\)$/.exec(line);
      if (group) { schemeType = group[1]; category = group[2]; }
      else fundHouse = line;
      continue;
    }
    const fields = line.split(";").map((field) => field.trim());
    if (fields.length !== headers.length || !/^\d+$/.test(fields[codeIndex])) continue;
    const nav = Number(fields[navIndex]);
    const date = fields[dateIndex];
    if (!Number.isFinite(nav) || nav <= 0 || !navDateToIso(date)) continue;
    const name = fields[nameIndex];
    const plan = planIndex < 0 ? "" : fields[planIndex];
    const option = optionIndex < 0 ? "" : fields[optionIndex];
    const fullName = [name, plan, option].filter(Boolean).join(" - ");
    const planType = /\bdirect\b/i.test(plan || name) ? "direct" : /\bregular\b/i.test(plan || name) ? "regular" : "unknown";
    const optionType = /\bgrowth\b/i.test(option || name) ? "growth" : /idcw|dividend|income distribution/i.test(option || name) ? "idcw" : "unknown";
    const iso = navDateToIso(date)!;
    const [year, month, day] = iso.split("-");
    const scheme: AmfiScheme = {
      schemeCode: fields[codeIndex], name: fullName, fundHouse, category, schemeType,
      planType, optionType, nav, navAsOf: `${day}-${month}-${year}`,
      isin: isinIndex >= 0 && fields[isinIndex] !== "-" ? fields[isinIndex] : undefined,
    };
    const previous = schemes.get(scheme.schemeCode);
    if (!previous || navDateToIso(previous.navAsOf)! < iso) schemes.set(scheme.schemeCode, scheme);
  }
  return [...schemes.values()];
}

let cached: { at: number; schemes: AmfiScheme[] } | undefined;
let pending: Promise<AmfiScheme[]> | undefined;
let pendingForced = false;

export async function getAmfiCatalogue(forceRefresh = false): Promise<AmfiScheme[]> {
  if (!forceRefresh && cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.schemes;
  if (pending) {
    if (forceRefresh && !pendingForced) {
      try { await pending; } catch { /* A forced check can retry a failed cached request. */ }
      return getAmfiCatalogue(true);
    }
    return pending;
  }
  pendingForced = forceRefresh;
  pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(AMFI_NAV_URL, { signal: controller.signal, ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: 900 } }) });
      if (!response.ok) throw new Error(`AMFI NAV feed returned ${response.status}`);
      const schemes = parseAmfiNav(await response.text());
      if (schemes.length < 100) throw new Error("AMFI NAV feed is incomplete");
      cached = { at: Date.now(), schemes };
      return schemes;
    } finally { clearTimeout(timeout); }
  })().finally(() => { pending = undefined; pendingForced = false; });
  return pending;
}

export function searchAmfiCatalogue(schemes: AmfiScheme[], query: string, limit = 30, now = new Date(), filters: FundSearchFilters = {}): AmfiScheme[] {
  const terms = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return schemes.filter((scheme) => scheme.schemeType === "Open Ended Schemes" && isRecentNav(scheme.navAsOf, now) &&
    (!filters.planType || scheme.planType === filters.planType) && (!filters.optionType || scheme.optionType === filters.optionType) &&
    !isExchangeTradedFund(scheme.name) && terms.every((term) => `${scheme.name} ${scheme.schemeCode}`.toLowerCase().includes(term)))
    .sort((a, b) => Number(b.planType === "direct") - Number(a.planType === "direct") ||
      Number(b.optionType === "growth") - Number(a.optionType === "growth") || a.name.localeCompare(b.name))
    .slice(0, limit);
}
