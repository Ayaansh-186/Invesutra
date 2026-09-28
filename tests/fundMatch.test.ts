import assert from "node:assert/strict";
import test from "node:test";
import { findExactLiveFund } from "../lib/marketData/matchFund";
import type { FundSearchResult } from "../lib/marketData/types";

function result(name: string, overrides: Partial<FundSearchResult> = {}): FundSearchResult {
  return { provider: "mutual-fund-mcp", name, dataQuality: "live", nav: 100, ...overrides };
}

test("refresh accepts an exact live scheme despite punctuation and Plan wording", () => {
  const match = result("HDFC Flexi Cap Fund - Direct Plan - Growth");
  assert.equal(findExactLiveFund("HDFC Flexi Cap Fund Direct Growth", [match]), match);
});

test("refresh never substitutes a different plan or a search result in first position", () => {
  assert.equal(findExactLiveFund("HDFC Flexi Cap Fund Direct Growth", [
    result("HDFC Flexi Cap Fund Regular Growth"),
    result("HDFC Flexi Cap Fund Direct IDCW"),
  ]), undefined);
});

test("refresh rejects partial, fallback, and invalid NAV results", () => {
  const name = "HDFC Flexi Cap Fund Direct Growth";
  assert.equal(findExactLiveFund(name, [
    result(name, { dataQuality: "partial" }),
    result(name, { dataQuality: "fallback" }),
    result(name, { nav: 0 }),
  ]), undefined);
});
