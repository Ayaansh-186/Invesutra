// In-memory only: never persist financial responses or share them across accounts.
export function createAccountRequestCache<T>(loader: (key: string) => Promise<T>, ttlMs = 30_000, now = Date.now) {
  let owner: string | null = null;
  let generation = 0;
  const completed = new Map<string, { value: T; at: number }>();
  const pending = new Map<string, Promise<T>>();
  function invalidate() { generation++; completed.clear(); pending.clear(); }
  function setOwner(next: string | null) {
    if (owner !== next) { owner = next; invalidate(); }
  }
  async function read(key: string, signal?: AbortSignal): Promise<T> {
    if (!owner) throw new Error("A signed-in account is required");
    if (signal?.aborted) throw signal.reason;
    const hit = completed.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    let request = pending.get(key);
    if (!request) {
      const version = generation;
      request = loader(key).then(value => {
        if (version === generation) completed.set(key, { value, at: now() });
        return value;
      }).finally(() => {
        if (version === generation) pending.delete(key);
      });
      pending.set(key, request);
    }
    if (!signal) return request;
    // One component unmounting must not cancel another component's shared request.
    return new Promise<T>((resolve, reject) => {
      const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
      signal.addEventListener("abort", abort, { once: true });
      request!.then(value => { signal.removeEventListener("abort", abort); resolve(value); },
        error => { signal.removeEventListener("abort", abort); reject(error); });
    });
  }
  return { read, setOwner, invalidate };
}
