import { isValidPurchaseDate } from "./purchase";

export interface PurchaseCorrection {
  schemeCode: string;
  purchaseNav: number;
  units: number;
  purchaseDate: string;
}

export function parsePurchaseCorrection(body: unknown): PurchaseCorrection | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.schemeCode !== "string" || !/^\d{1,12}$/.test(input.schemeCode) ||
      typeof input.purchaseDate !== "string" || !isValidPurchaseDate(input.purchaseDate) ||
      typeof input.purchaseNav !== "number" || typeof input.units !== "number") return null;
  const { purchaseNav, units } = input;
  if (!Number.isFinite(purchaseNav) || purchaseNav <= 0 || purchaseNav >= 1e6 ||
      !Number.isFinite(units) || units <= 0 || units >= 1e10 ||
      Math.abs(units * 10000 - Math.round(units * 10000)) > 0.00001) return null;
  return { schemeCode: input.schemeCode, purchaseDate: input.purchaseDate, purchaseNav, units };
}

export function purchaseHistoryRepairError(
  purchases: { type: string; notes: string | null }[], schemeCode: string
): string | null {
  if (purchases.length > 1 || purchases.some(purchase => purchase.type !== "buy")) {
    return "This holding has multiple transactions. Purchase correction is limited to a single purchase so existing history is preserved.";
  }
  const knownCode = /^AMFI scheme (\d+)$/.exec(purchases[0]?.notes || "")?.[1];
  return knownCode && knownCode !== schemeCode
    ? "The scheme cannot be changed. Select the same scheme and plan as your existing holding."
    : null;
}
