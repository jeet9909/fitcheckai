import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Real backend client. Undefined/empty env vars (e.g. the GH Pages
// VITE_MOCK_API build, which has no Supabase project) leave `supabase` null
// rather than throwing — every caller must check `isSupabaseConfigured`
// (or the null) before use and fall back to the existing mock/local behavior.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
