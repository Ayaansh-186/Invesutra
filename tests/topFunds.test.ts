import assert from "node:assert/strict";
import test from "node:test";
import { rankFunds, selectDirectGrowthScheme } from "../lib/marketData/topFunds";
import type { RankedFund } from "../lib/marketData/topFunds";

test("top-fund rankings use the selected period and omit stale or missing NAVs", () => {
  const funds: RankedFund[] = [
    { schemeCode: 1, name: "A", category: "Equity", nav: 10, navAsOf: "30-09-2026", returns1Y: 10, returns3Y: 20 },
    { schemeCode: 2, name: "B", category: "Equity", nav: 10, navAsOf: "30-09-2026", returns1Y: 15, returns3Y: 5 },
    { schemeCode: 3, name: "Stale", category: "Equity", nav: 10, navAsOf: "01-06-2020", returns1Y: 200 },
  ];
  const now = new Date("2026-10-01T12:00:00Z");
  assert.deepEqual(rankFunds(funds, "1Y", now).map((fund) => fund.name), ["B", "A"]);
  assert.deepEqual(rankFunds(funds, "3Y", now).map((fund) => fund.name), ["A", "B"]);
  assert.deepEqual(rankFunds(funds, "5Y", now), []);
});

test("ranking search rejects similarly named schemes and regular plans", () => {
  const hits = [
    { schemeCode: 1, schemeName: "UTI Nifty 500 Value 50 Index Fund - Direct Plan - Growth" },
    { schemeCode: 2, schemeName: "UTI Nifty 50 Index Fund - Regular Plan - Growth" },
    { schemeCode: 3, schemeName: "UTI Nifty 50 Index Fund - Direct Plan - Growth" },
  ];
  assert.equal(selectDirectGrowthScheme("UTI Nifty 50 Index Fund", hits)?.schemeCode, 3);
  assert.equal(selectDirectGrowthScheme("Axis Midcap Fund", hits), undefined);
});
