import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client (uses anon key, respects RLS)
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey);
}

// Convenience alias
export const supabase = {
  get client() {
    return getSupabaseClient();
  },
};

// Server-side Supabase client (uses service role key, bypasses RLS)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }
  return createClient(url, serviceRoleKey);
}
