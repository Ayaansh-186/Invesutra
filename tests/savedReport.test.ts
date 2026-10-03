import assert from "node:assert/strict";
import test from "node:test";
import { generateReport } from "../lib/algorithm/reportEngine";
import { readSavedReport } from "../lib/utils/savedReport";
import { SAMPLE_PORTFOLIO } from "../lib/utils/mockData";
import type { DbAIReport } from "../lib/supabase/database.types";

test("a complete report survives a JSON/database round trip with its historical values", () => {
  const report = generateReport(SAMPLE_PORTFOLIO);
  const row = { id: "persisted-report-id", generated_at: "2026-10-03T08:00:00Z",
    report_snapshot: JSON.parse(JSON.stringify({ version: 1, report })) } as DbAIReport;
  const restored = readSavedReport(row)!;
  assert.equal(restored.id, row.id);
  assert.equal(restored.summary, report.summary);
  assert.deepEqual(restored.analysis, report.analysis);
  assert.deepEqual(restored.funds, report.funds);
  assert.deepEqual(restored.riskMetrics, report.riskMetrics);
  assert.equal(restored.riskMetrics.beta, null);
});

test("legacy and incomplete snapshots do not invent historical report details", () => {
  assert.equal(readSavedReport({ summary: "Legacy saved summary" } as DbAIReport), null);
  assert.equal(readSavedReport({ report_snapshot: { version: 2, report: generateReport(SAMPLE_PORTFOLIO) } } as DbAIReport), null);
  assert.equal(readSavedReport({ report_snapshot: { version: 1, report: { portfolio: "Missing figures" } } } as DbAIReport), null);
});
