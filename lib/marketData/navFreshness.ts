const DAY_MS = 24 * 60 * 60 * 1000;

export function navDateToIso(value?: string): string | undefined {
  const match = /^(\d{2})-(\d{2}|[A-Za-z]{3})-(\d{4})$/.exec(value || "");
  if (!match) return undefined;
  const day = Number(match[1]);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = /^\d+$/.test(match[2]) ? Number(match[2]) : months.indexOf(match[2].toLowerCase()) + 1;
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}

export function isRecentNav(asOf?: string, now = new Date()): boolean {
  const iso = navDateToIso(asOf);
  if (!iso) return false;
  const india = new Date(now.getTime() + 330 * 60 * 1000);
  const today = Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate());
  const ageDays = (today - Date.parse(`${iso}T00:00:00Z`)) / DAY_MS;
  return ageDays >= 0 && ageDays <= 5;
}
