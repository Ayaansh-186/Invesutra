const DAY_MS = 24 * 60 * 60 * 1000;

export function isRecentNav(asOf?: string, now = new Date()): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(asOf || "");
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const navDate = new Date(Date.UTC(year, month - 1, day));
  if (navDate.getUTCFullYear() !== year || navDate.getUTCMonth() !== month - 1 || navDate.getUTCDate() !== day) {
    return false;
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = (today - navDate.getTime()) / DAY_MS;
  return ageDays >= -1 && ageDays <= 10;
}
