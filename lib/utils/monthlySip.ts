// Undefined means no plan; null means invalid input. Plans never create purchases.
export function parseMonthlySipAmount(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1e9 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) return null;
  return Math.round(value * 100) / 100;
}
