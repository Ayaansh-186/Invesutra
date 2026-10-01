import type { FundDetails } from "./types";
import { navDateToIso } from "./navFreshness";
import { getSchemeDetail, purchaseNavForDate } from "@/lib/mcp/mutualFundSource";

export async function getPurchaseQuote(fund: FundDetails, purchaseDate: string) {
  if (navDateToIso(fund.navAsOf) === purchaseDate && fund.nav && fund.nav > 0 && Number.isFinite(fund.nav)) {
    return { nav: fund.nav, date: purchaseDate, sourceUrl: fund.sourceUrl };
  }
  const history = await getSchemeDetail(fund.schemeCode);
  const point = purchaseNavForDate(history.data, purchaseDate);
  if (!point) return undefined;
  return { nav: Number(point.nav), date: purchaseDate, sourceUrl: `https://api.mfapi.in/mf/${fund.schemeCode}` };
}
