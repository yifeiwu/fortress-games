import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseServerConfig(): { url: string; serviceKey: string } {
  if (!url || !serviceKey) {
    throw new Error("Supabase server configuration is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, serviceKey };
}

// One service-role client per server runtime. Each runtime-state query used to
// spin up its own client (~21 per logical operation); reusing a single instance
// avoids that per-call construction overhead.
const globalClient = globalThis as unknown as { __fortressServerClient?: SupabaseClient };

export function getSupabaseServerClient() {
  if (!globalClient.__fortressServerClient) {
    const { url: configUrl, serviceKey: configKey } = getSupabaseServerConfig();
    globalClient.__fortressServerClient = createClient(configUrl, configKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return globalClient.__fortressServerClient;
}
