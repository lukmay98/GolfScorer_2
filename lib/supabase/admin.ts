import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only client using the service role key. NEVER import this in a
// "use client" component or expose SUPABASE_SERVICE_ROLE_KEY to the browser
// — it bypasses Row Level Security entirely.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}