// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const auth = vi.hoisted(() => ({ allowed: false }));
vi.mock("@/modules/kashrut-admin/authorize", () => ({ authorize: async () => auth.allowed ? { user: { id: "manager" } } : { error: NextResponse.json({ error: "MANAGER_REQUIRED" }, { status: 403 }) } }));
import { GET } from "@/app/api/admin/metrics/google/route";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.allowed = false; });
it("blocks non-managers before reading metrics", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  expect((await GET()).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns daily counters to a manager without exposing the privileged credential", async () => {
  auth.allowed = true;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-role");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ day: "2026-10-22", sku: "place_photo", calls: 1, failures: 0 }])));
  const response = await GET();
  const body = await response.json();
  expect(body.days[0].calls).toBe(1); expect(JSON.stringify(body)).not.toContain("private-role");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
