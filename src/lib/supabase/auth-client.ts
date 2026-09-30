import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./config";

export function createAuthBrowserClient() {
  const config = getPublicSupabaseConfig();
  return config ? createBrowserClient(config.url, config.anonKey) : null;
}
