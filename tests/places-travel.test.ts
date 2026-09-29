import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/places/travel/route";
import { travelLabel } from "@/modules/places/travel";

const originalKey = process.env.GOOGLE_PLACES_API_KEY;
afterEach(() => { vi.restoreAllMocks(); if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = originalKey; });

describe("travel from the user's location", () => {
  const origin = { latitude: 31.75, longitude: 34.99 };
  const destination = { latitude: 31.78, longitude: 35.02 };

  it("labels aerial distance honestly when a route is unavailable", () => {
    expect(travelLabel(origin, destination, undefined, true)).toContain("בקו אווירי");
    expect(travelLabel(origin, destination, { distanceKm: 5.2, minutes: 14 }, true)).toBe("5.2 ק״מ · 14 דק׳ בנסיעה");
    expect(travelLabel(null, destination, undefined, true)).toBeNull();
  });

  it("requests real route distances in one bounded matrix", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ destinationIndex: 0, condition: "ROUTE_EXISTS", distanceMeters: 5300, duration: "840s" }] )));
    const result = await POST(new NextRequest("http://localhost/api/places/travel", { method: "POST", body: JSON.stringify({ origin, destinations: [destination] }) }));
    const body = await result.json();
    expect(body.routes).toEqual([{ distanceKm: 5.3, minutes: 14 }]);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).routingPreference).toBe("TRAFFIC_UNAWARE");
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("rejects an invalid origin before contacting Google", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const result = await POST(new NextRequest("http://localhost/api/places/travel", { method: "POST", body: JSON.stringify({ origin: { latitude: 0, longitude: 0 }, destinations: [destination] }) }));
    expect(result.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
