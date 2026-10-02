import assert from "node:assert/strict";
import test from "node:test";
import { parseAmfiNav, searchAmfiCatalogue, isExchangeTradedFund } from "../lib/marketData/amfi";
import { applyVerifiedNav } from "../lib/marketData/valuation";
import { preparePendingPortfolio, markVerificationUnavailable } from "../lib/marketData/pendingPortfolio";
import { hasVerifiedValue, hasVerifiedMetric, isPortfolioDataReady } from "../lib/marketData/quality";
import { getSchemeDetail } from "../lib/mcp/mutualFundSource";
import { getPurchaseQuote } from "../lib/marketData/purchaseQuote";
import { navDateToIso, isRecentNav } from "../lib/marketData/navFreshness";
import { createRebalanceEngine } from "../lib/algorithm/rebalanceEngine";
import { answerPortfolioQuestion } from "../lib/ai/portfolioAssistant";
import { analyzePortfolioWithAI } from "../lib/ai/analyze";
import { SAMPLE_PORTFOLIO } from "../lib/utils/mockData";
import type { FundDetails } from "../lib/marketData/types";

const now = new Date("2026-10-01T06:00:00Z");
const header = "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date";
const feed = `${header}
Open Ended Schemes(Equity Scheme - Flexi Cap Fund)
Test Mutual Fund
123;INF123;-;Test Fund;Direct Plan;Growth Option;25.12345;30-Sep-2026
124;INF124;-;Test Fund;Regular Plan;Growth Option;24.1234;30-Sep-2026
125;INF125;-;Test Fund;Direct Plan;IDCW;14.1234;30-Sep-2026
126;INF126;-;Old Fund;Direct Plan;Growth;10;01-Jun-2018
127;INF127;-;Test ETF;Direct Plan;Growth;10;30-Sep-2026
128;INF128;-;Invalid Fund;Direct Plan;Growth;NaN;30-Sep-2026
129;INF129;-;Invalid Fund;Direct Plan;Growth;10;31-Sep-2026
Close Ended Schemes(Debt Scheme)
130;INF130;-;Test Closed Fund;Direct Plan;Growth;10;30-Sep-2026`;
const holding = { ...SAMPLE_PORTFOLIO.funds[0], name: "Test Fund", schemeCode: "123", units: 20, currentValue: 999999 };
const detail: FundDetails = { schemeCode: 123, name: "Test Fund - Direct Plan - Growth", category: "flexi_cap", riskLevel: "high", nav: 25.12345, navAsOf: "30-09-2026", sourceUrl: "https://portal.amfiindia.com/spages/NAVAll.txt" };

test("fast saved-holdings responses never expose saved prices as verified data", () => {
  const pending = preparePendingPortfolio({ ...SAMPLE_PORTFOLIO, funds: [{ ...holding, valuationStatus: "verified", purchaseStatus: "verified", navAsOf: "30-09-2026" }] });
  assert.equal(pending.valuationPending, true);
  assert.equal(pending.funds[0].valuationStatus, "pending");
  assert.equal(pending.funds[0].currentValue, holding.currentValue);
  assert.equal(pending.funds[0].navAsOf, undefined);
  assert.equal(pending.currentValue, 0);
  assert.equal(pending.analysis, undefined);
  assert.equal(hasVerifiedValue(pending.funds[0]), false);
  assert.equal(hasVerifiedMetric(pending.funds[0], "returns1Y"), false);
  assert.equal(isPortfolioDataReady(pending), false);
  assert.equal(holding.currentValue, 999999);
});

test("failed background checks retain holdings and clear the pending state", () => {
  const unavailable = markVerificationUnavailable({ ...SAMPLE_PORTFOLIO, funds: [holding, { ...holding, id: "legacy", units: 0 }, { ...holding, id: "etf", name: "Test ETF" }] });
  assert.equal(unavailable.valuationPending, false);
  assert.equal(unavailable.funds.length, 3);
  assert.deepEqual(unavailable.funds.map((fund) => fund.valuationStatus), ["unavailable", "missing_units", "unsupported"]);
  assert.equal(isPortfolioDataReady(unavailable), false);
  assert.equal(preparePendingPortfolio({ ...SAMPLE_PORTFOLIO, funds: [] }).valuationPending, false);
});

test("concurrent public NAV history lookups share one request and failed requests can retry", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ meta: { scheme_code: 999001, scheme_name: "Test Fund Direct Growth", scheme_category: "Equity Scheme - Large Cap Fund" }, data: [] }), { status: calls === 1 ? 503 : 200 });
  };
  try {
    const failed = await Promise.allSettled([getSchemeDetail(999001), getSchemeDetail(999001)]);
    assert.equal(calls, 1);
    assert.ok(failed.every((result) => result.status === "rejected"));
    const [a, b] = await Promise.all([getSchemeDetail(999001), getSchemeDetail(999001)]);
    assert.equal(calls, 2);
    assert.equal(a, b);
    await getSchemeDetail(999001);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("AMFI parser reads separated plan/option columns and rejects invalid rows", () => {
  const schemes = parseAmfiNav(feed);
  assert.equal(schemes.length, 6);
  assert.equal(schemes[0].name, "Test Fund - Direct Plan - Growth Option");
  assert.equal(schemes[0].nav, 25.12345);
  assert.equal(schemes[0].navAsOf, "30-09-2026");
  assert.equal(schemes[0].planType, "direct");
  assert.equal(schemes[0].optionType, "growth");
});

test("malformed scheme history is rejected and evicted so a valid response can retry", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({meta:{scheme_code:999002,...(calls > 1 ? {scheme_name:"Test Fund",scheme_category:"Equity"} : {})},data:[]});
  };
  try {
    await assert.rejects(getSchemeDetail(999002), /Invalid scheme history/);
    assert.equal((await getSchemeDetail(999002)).meta.scheme_name,"Test Fund");
    assert.equal(calls,2);
  } finally { globalThis.fetch = original; }
});

test("plan and payout filters use metadata before limiting results, including Dividend aliases", () => {
  const schemes = parseAmfiNav(feed.replace(";IDCW;", ";Dividend Option;"));
  const payout = searchAmfiCatalogue(schemes, "test", 1, now, { planType: "direct", optionType: "idcw" });
  assert.equal(payout.length, 1);
  assert.equal(payout[0].schemeCode, "125");
  assert.equal(searchAmfiCatalogue(schemes, "test", 1, now, { planType: "regular", optionType: "growth" })[0].schemeCode, "124");
});

test("AMFI parser retains support for the six-column daily NAV format", () => {
  const schemes = parseAmfiNav("Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date\nOpen Ended Schemes(Equity Scheme)\nTest Mutual Fund\n123;INF123;-;Test Direct Growth;10.12;30-Sep-2026");
  assert.equal(schemes[0].planType, "direct");
  assert.equal(schemes[0].nav, 10.12);
});

test("search excludes stale/closed schemes and ETFs and distinguishes plans", () => {
  const schemes = parseAmfiNav(feed);
  assert.deepEqual(searchAmfiCatalogue(schemes, "test", 30, now).map((s) => s.schemeCode), ["123", "125", "124"]);
  assert.deepEqual(searchAmfiCatalogue(schemes, "test regular growth", 30, now).map((s) => s.schemeCode), ["124"]);
  assert.equal(searchAmfiCatalogue(schemes, "123", 30, now)[0].schemeCode, "123");
});

test("duplicate AMFI scheme codes keep the newest published NAV", () => {
  const schemes = parseAmfiNav(`${feed}\n123;INF123;-;Test Fund;Direct Plan;Growth;20;29-Sep-2026`);
  assert.equal(schemes.find((s) => s.schemeCode === "123")?.nav, 25.12345);
});

test("ETF fund-of-funds are mutual funds, not exchange-traded holdings", () => {
  assert.equal(isExchangeTradedFund("Mirae Asset NYSE FANG+ ETF"), true);
  assert.equal(isExchangeTradedFund("Mirae Asset NYSE FANG+ ETF Fund of Fund"), false);
});

test("NAV freshness uses the India calendar day and rejects invalid dates", () => {
  assert.equal(isRecentNav("01-Oct-2026", new Date("2026-09-30T19:00:00Z")), true);
  assert.equal(isRecentNav("02-Oct-2026", now), false);
  assert.equal(navDateToIso("31-Sep-2026"), undefined);
});

test("new funds can use the official same-day quote without historical returns", async () => {
  assert.deepEqual(await getPurchaseQuote(detail, "2026-09-30"), { nav: 25.12345, date: "2026-09-30", sourceUrl: detail.sourceUrl });
  const valued = applyVerifiedNav(holding, detail, now);
  assert.equal(valued.valuationStatus, "verified");
  assert.equal(valued.currentValue, 502.47);
  assert.deepEqual(valued.verifiedMetrics, []);
});

test("valuations reject stale NAVs, missing units, and wrong scheme codes", () => {
  assert.equal(applyVerifiedNav(holding, { ...detail, navAsOf: "20-09-2026" }, now).valuationStatus, "stale");
  assert.equal(applyVerifiedNav({ ...holding, units: 0 }, detail, now).valuationStatus, "missing_units");
  assert.equal(applyVerifiedNav(holding, { ...detail, schemeCode: 124 }, now).valuationStatus, "unavailable");
  assert.equal(applyVerifiedNav(holding, { ...detail, nav: Infinity }, now).valuationStatus, "unavailable");
});

test("rebalance suggestions pause on unverified holdings and omit missing return metrics", () => {
  const engine = createRebalanceEngine();
  assert.deepEqual(engine.generateRebalancingSuggestions([{ ...holding, valuationStatus: "stale" }], holding.currentValue), []);
  assert.deepEqual(engine.generateRebalancingSuggestions([{ ...holding, category: "large_cap", returns1Y: -99, verifiedMetrics: [], valuationStatus: "verified", purchaseStatus: "verified" }], holding.currentValue), []);
});

test("financial AI defaults to local even when an online provider is configured", async () => {
  const previous = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "not-a-real-key";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("No external request allowed"); };
  try {
    const response = await answerPortfolioQuestion(SAMPLE_PORTFOLIO, [{ role: "user", content: "Review my holdings" }]);
    assert.equal(response.source, "deterministic");
    const analysis = await analyzePortfolioWithAI(SAMPLE_PORTFOLIO);
    assert.equal(analysis.source, "deterministic");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previous;
  }
});

test("AI cannot recommend from incomplete data even with online permission", async () => {
  const response = await answerPortfolioQuestion({ ...SAMPLE_PORTFOLIO, valuationComplete: false }, [{ role: "user", content: "What should I invest in?" }], undefined, { allowPrivateAI: true });
  assert.equal(response.source, "deterministic");
  assert.match(response.answer, /paused/i);
});
