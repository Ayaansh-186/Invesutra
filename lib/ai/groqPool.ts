export interface GroqCredential { apiKey: string; quotaGroup: string }

export function groqCredentials(env: Record<string, string | undefined> = process.env): GroqCredential[] {
  const seen = new Set<string>();
  const result: GroqCredential[] = [];
  for (let index = 1; index <= 5; index++) {
    const suffix = index === 1 ? "" : `_${index}`;
    const apiKey = env[`GROQ_API_KEY${suffix}`]?.trim();
    if (!apiKey || seen.has(apiKey)) continue;
    seen.add(apiKey);
    result.push({ apiKey, quotaGroup: env[`GROQ_QUOTA_GROUP${suffix}`]?.trim() || "shared" });
  }
  return result;
}

export function retryDelay(headers?: Headers, now = Date.now()): number {
  const raw = headers?.get("retry-after");
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(1000, date - now);
  }
  return 60_000;
}

function resetDelay(value: string | null): number {
  if (!value) return 60_000;
  const match = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value);
  if (!match || !match.slice(1).some(Boolean)) return 60_000;
  return Math.max(1000, (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000);
}

// Warm-instance cooldowns are shared by normal and tool calls, never by user data.
export class GroqPool {
  private groups = new Map<string, number>();
  private keys = new Map<string, number>();
  constructor(private now: () => number = Date.now) {}

  async run<T>(credentials: GroqCredential[], call: (credential: GroqCredential, remainingMs: number) => Promise<{ data: T; headers: Headers }>): Promise<T> {
    let lastError: unknown = new Error("Groq quota groups are cooling down or unconfigured.");
    const deadline = this.now() + 20_000;
    for (const credential of credentials) {
      const now = this.now();
      if (now >= deadline) break;
      if ((this.groups.get(credential.quotaGroup) || 0) > now || (this.keys.get(credential.apiKey) || 0) > now) continue;
      try {
        const result = await call(credential, deadline - now);
        let delay = 0;
        for (const kind of ["requests", "tokens"]) {
          if (result.headers.get(`x-ratelimit-remaining-${kind}`) === "0") delay = Math.max(delay, resetDelay(result.headers.get(`x-ratelimit-reset-${kind}`)));
        }
        if (delay) this.groups.set(credential.quotaGroup, this.now() + delay);
        return result.data;
      } catch (error) {
        const failure = error as { status?: number; headers?: Headers };
        if (failure.status === 429) {
          this.groups.set(credential.quotaGroup, this.now() + retryDelay(failure.headers, this.now()));
        } else {
          this.keys.set(credential.apiKey, this.now() + (failure.status === 401 || failure.status === 403 ? 600_000 : 10_000));
        }
        lastError = error;
        // Invalid requests cannot be repaired by trying another credential.
        if (failure.status === 400 || failure.status === 422) break;
      }
    }
    throw lastError;
  }
}
