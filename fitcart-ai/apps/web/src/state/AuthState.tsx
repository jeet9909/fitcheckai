import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthStateValue {
  user: User | null;
  /** True once a real account exists — false for the bootstrap anonymous session. */
  isRealAccount: boolean;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthStateValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // If Supabase isn't configured (e.g. the GH Pages mock-API build), there's
  // no session to wait for — start "not loading" so callers never hang.
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    // The product promises "2 free looks, no signup" (Landing.tsx) — that
    // needs a real auth.uid() for guests too, so storage RLS and the
    // server-side render quota (create-render Edge Function) can apply to
    // them the same way they do to signed-in users. Anonymous auth gives a
    // guest a real session on first visit; supabase.auth.linkIdentity()
    // on signup/Google carries that same uid forward instead of starting a
    // fresh one, so usage history isn't lost by creating an account.
    client.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }
      const { data: anon, error } = await client.auth.signInAnonymously();
      if (error) {
        // Non-fatal — features that need a uid (photo upload, try-on,
        // saving) will surface their own "sign in" prompt.
        setLoading(false);
        return;
      }
      setSession(anon.session);
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const user = session?.user ?? null;

  const value = useMemo<AuthStateValue>(() => ({
    user,
    isRealAccount: Boolean(user && !user.is_anonymous),
    session,
    loading,
    signOut,
  }), [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthStateValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
