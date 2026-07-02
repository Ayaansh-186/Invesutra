"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Whether real Supabase credentials are configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createSafeClient() {
  if (!isSupabaseConfigured) {
    // Return a null-safe stub so the app never crashes in demo mode
    // All auth calls will resolve to { user: null, error: null }
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key-000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSafeClient();
export function createBrowserSupabaseClient() {
  return createSafeClient();
}
