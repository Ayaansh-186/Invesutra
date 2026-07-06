"use client";

import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    // If Supabase isn't configured, immediately resolve to no user (demo mode)
    if (!isSupabaseConfigured) {
      setState({ user: null, loading: false });
      return;
    }

    let mounted = true;

    // getSession() reads from local storage (near-instant) instead of
    // round-tripping to Supabase's auth server like getUser() does. This
    // is safe for client-side UI gating because real authorization still
    // happens server-side (RLS policies + getUser() in API routes and
    // middleware) — this call only decides what to show, not what's
    // allowed.
    supabase.auth.getSession()
      .then(({ data }) => {
        if (mounted) setState({ user: data?.session?.user ?? null, loading: false });
      })
      .catch(() => {
        if (mounted) setState({ user: null, loading: false });
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (isSupabaseConfigured) await supabase.auth.signOut();
    } catch {}
    setState({ user: null, loading: false });
  }, []);

  return { ...state, signOut };
}
