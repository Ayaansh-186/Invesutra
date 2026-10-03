import type { DbAIReport } from "@/lib/supabase/database.types";
import type { GeneratedReport } from "@/lib/algorithm/reportEngine";

export function readSavedReport(row: DbAIReport): GeneratedReport | null {
  const snapshot = row.report_snapshot as { version?: unknown; report?: Partial<GeneratedReport> } | null;
  const report = snapshot?.report;
  if (snapshot?.version !== 1 || !report || typeof report.portfolio !== "string" ||
      typeof report.summary !== "string" || typeof report.healthScore !== "number" ||
      !report.analysis || typeof report.analysis.diversificationScore !== "number" ||
      !report.riskMetrics || !report.allocationBreakdown?.byCategory ||
      !Array.isArray(report.funds) || !Array.isArray(report.issues) ||
      !Array.isArray(report.recommendations) || !Array.isArray(report.rebalanceSuggestions)) return null;
  // Historical values are restored from the snapshot, never today's portfolio.
  return { ...report, id: row.id, generatedAt: new Date(row.generated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) } as GeneratedReport;
}
