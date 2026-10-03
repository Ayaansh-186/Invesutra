import type { DbAIReport } from "@/lib/supabase/database.types";
import { readSavedReport } from "./savedReport";

export function compareSavedReports(first: DbAIReport, second: DbAIReport) {
  if (first.id === second.id || first.portfolio_id !== second.portfolio_id || first.user_id !== second.user_id) return null;
  const rows = [first, second].sort((a,b)=>a.generated_at.localeCompare(b.generated_at));
  const reports = rows.map(readSavedReport);
  if (!reports[0] || !reports[1]) return null;
  const values = reports.map(report => ({
    value: report!.funds.reduce((sum,fund)=>sum+fund.currentValue,0),
    invested: report!.funds.reduce((sum,fund)=>sum+fund.investedAmount,0),
    health: report!.healthScore,
    diversification: report!.analysis.diversificationScore,
  }));
  if (values.some(row=>Object.values(row).some(value=>!Number.isFinite(value)))) return null;
  return { earlier: rows[0], later: rows[1], before: values[0], after: values[1], valueChange: values[1].value-values[0].value, investedChange: values[1].invested-values[0].invested };
}
