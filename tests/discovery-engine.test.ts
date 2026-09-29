import { afterEach, describe, expect, it } from "vitest";
import { favoriteTheme, profileKey, rankPlaces, readProfile, recentlySeen, recordSignal } from "@/modules/places/discovery-engine";

afterEach(() => localStorage.removeItem(profileKey));

describe("place discovery signals", () => {
  it("only records an impression for a place the user actually viewed", () => {
    const now = 1_800_000_000_000;
    recordSignal("park", "nature", "impression", now);
    recordSignal("park", "nature", "impression", now + 1000);
    expect(readProfile().places.park.impressions).toBe(1);
    expect(recentlySeen(readProfile(), now + 2000)).toEqual(["park"]);
  });

  it("moves a recently seen place back and learns from explicit interest", () => {
    const now = 1_800_000_000_000;
    const choices = [{ id: "old", theme: "nature" as const }, { id: "new", theme: "food" as const }];
    recordSignal("old", "nature", "impression", now - 60_000);
    recordSignal("old", "nature", "like", now, true);
    expect(rankPlaces(choices, readProfile(), now).map(place => place.id)).toEqual(["new", "old"]);
    recordSignal("old", "nature", "open", now + 2 * 86_400_000);
    recordSignal("old", "nature", "save", now + 2 * 86_400_000, true);
    expect(rankPlaces(choices, readProfile(), now + 2 * 86_400_000).map(place => place.id)).toEqual(["old", "new"]);
  });

  it("mixes interests instead of filling a feed with a single theme", () => {
    const profile = { version: 1 as const, places: {}, interests: { nature: 12 } };
    const choices = [
      { id: "a", theme: "nature" as const }, { id: "b", theme: "nature" as const },
      { id: "c", theme: "nature" as const }, { id: "d", theme: "food" as const },
    ];
    expect(rankPlaces(choices, profile).map(place => place.id)).toEqual(["a", "b", "d", "c"]);
    expect(favoriteTheme(profile)).toBe("nature");
    expect(favoriteTheme({ version: 1, places: {}, interests: {} })).toBeNull();
  });
});
