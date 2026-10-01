export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePurchaseValues(purchaseNav: number, units: number, latestNav: number) {
  if (![purchaseNav, units, latestNav].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  const investedAmount = roundMoney(purchaseNav * units);
  const currentValue = roundMoney(latestNav * units);
  if (!Number.isFinite(investedAmount) || !Number.isFinite(currentValue) || investedAmount <= 0) {
    return null;
  }
  return { investedAmount, currentValue };
}

export function todayInIndia(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isValidPurchaseDate(value: string, now = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day && value <= todayInIndia(now);
}
