export function safeInternalRedirect(value: string | null, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://invesutra.invalid");
    if (url.origin !== "https://invesutra.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
