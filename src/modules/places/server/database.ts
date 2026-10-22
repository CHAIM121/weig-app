import "server-only";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/** Server-only writes. Never import from a client component. */
export async function placesDatabase<T>(path: string, body?: unknown, privileged = false): Promise<T | null> {
  const config = getPublicSupabaseConfig();
  const key = privileged ? process.env.SUPABASE_SERVICE_ROLE_KEY : config?.anonKey;
  if (!config || !key) return null;
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("PLACES_DATABASE_UNAVAILABLE");
  return response.status === 204 ? null : response.json() as Promise<T>;
}
