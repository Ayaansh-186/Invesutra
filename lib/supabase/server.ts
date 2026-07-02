import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads/writes the auth session via Next.js cookies.
 *
 * Note: intentionally untyped (no `Database` generic). The strict Postgrest
 * generic chain in this client version infers `never` for insert/update
 * payloads on tables with optional columns, which is more friction than
 * value for an app this size. Row shapes are still documented and enforced
 * via the `Db*` interfaces in `database.types.ts` — use those for read
 * results, e.g. `data as DbSubscription | null`.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component without a writable response —
          // safe to ignore if middleware also refreshes the session.
        }
      },
    },
  });
}

/**
 * Service-role Supabase client for trusted server contexts only
 * (webhooks, cron jobs, admin scripts). Bypasses Row Level Security.
 * NEVER expose this client or the service role key to the browser.
 */
export function createServiceSupabaseClient(): SupabaseClient {
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createSupabaseJsClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
