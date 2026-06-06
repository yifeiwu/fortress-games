import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Reuse a single browser client across the lobby and every room mount so we
// don't open a fresh websocket connection on each navigation.
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!url || !anonKey) {
    return null;
  }
  client ??= createClient(url, anonKey);
  return client;
}
