import Papa from "papaparse";
import { parsePurchaseCorrection, type PurchaseCorrection } from "./holdingRepair";

export const PURCHASE_CSV_HEADER = "scheme_code,allotment_date,units,buying_nav";
export function parsePurchaseCsv(text: string, schemeCode: string): PurchaseCorrection[] {
  if (text.length > 100000) throw new Error("CSV must be smaller than 100 KB.");
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: header => header.trim().replace(/^\uFEFF/, "") });
  if (result.errors.length || result.meta.fields?.join(",") !== PURCHASE_CSV_HEADER) throw new Error(`Use these exact CSV columns: ${PURCHASE_CSV_HEADER}.`);
  if (!result.data.length || result.data.length > 200) throw new Error("Import between 1 and 200 actual allotments.");
  const seen = new Set<string>();
  return result.data.map((row, index) => {
    if (![row.units,row.buying_nav].every(value=>typeof value==='string' && /^\d+(\.\d+)?$/.test(value.trim()))) throw new Error(`Row ${index + 2}: use plain positive decimal numbers for units and NAV.`);
    const purchase = parsePurchaseCorrection({ schemeCode: row.scheme_code?.trim(), purchaseDate: row.allotment_date?.trim(), units: Number(row.units), purchaseNav: Number(row.buying_nav) });
    if (!purchase || purchase.schemeCode !== schemeCode) throw new Error(`Row ${index + 2}: check the exact scheme code, YYYY-MM-DD allotment date, units and buying NAV.`);
    const key = `${purchase.purchaseDate}:${purchase.units}:${purchase.purchaseNav}`;
    if (seen.has(key)) throw new Error(`Row ${index + 2}: duplicate allotment in this file.`);
    seen.add(key); return purchase;
  });
}
