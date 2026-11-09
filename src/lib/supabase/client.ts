import { createBrowserClient } from "@supabase/ssr";

// Singleton browser client. Creating a new GoTrue client on every render
// (as the dashboard used to do) spawns multiple auto-refresh timers that
// race over the token-refresh lock and can drop the session. One client
// per browser tab: the session is stored in cookies by @supabase/ssr and
// shared by every caller. No tokens are kept in localStorage.
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
