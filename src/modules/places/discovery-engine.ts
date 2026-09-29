export type DiscoveryTheme = "nature" | "heritage" | "family" | "food" | "other";
export type Signal = "impression" | "open" | "like" | "save" | "share" | "navigate";
export type PlaceCandidate = { id: string; theme?: DiscoveryTheme };

type PlaceHistory = { seenAt?: number; impressions?: number; opens?: number; liked?: boolean; saved?: boolean };
export type DiscoveryProfile = { version: 1; places: Record<string, PlaceHistory>; interests: Partial<Record<DiscoveryTheme, number>> };
export const profileKey = "weig-place-discovery-v1";
const empty = (): DiscoveryProfile => ({ version: 1, places: {}, interests: {} });

export function readProfile(): DiscoveryProfile {
  if (typeof localStorage === "undefined") return empty();
  try {
    const data = JSON.parse(localStorage.getItem(profileKey) || "null");
    if (data?.version === 1 && data.places && typeof data.places === "object" && data.interests && typeof data.interests === "object") return data;
  } catch {}
  return empty();
}

export function recordSignal(id: string, theme: DiscoveryTheme | undefined, signal: Signal, now = Date.now(), active?: boolean) {
  if (!id || typeof localStorage === "undefined") return;
  const profile = readProfile();
  const old = profile.places[id] ?? {};
  const next: PlaceHistory = { ...old };
  if (signal === "impression") {
    // One exposure per place per visit interval, not every scroll event.
    if (!old.seenAt || now - old.seenAt > 30 * 60_000) { next.seenAt = now; next.impressions = Math.min((old.impressions ?? 0) + 1, 99); }
  } else if (signal === "open") next.opens = Math.min((old.opens ?? 0) + 1, 99);
  else if (signal === "like") next.liked = active ?? !old.liked;
  else if (signal === "save") next.saved = active ?? !old.saved;
  if (theme && theme !== "other" && (signal === "open" || signal === "share" || signal === "navigate" || (signal === "like" && next.liked) || (signal === "save" && next.saved))) {
    const weight = signal === "open" ? 1 : signal === "like" || signal === "save" ? 3 : 2;
    profile.interests[theme] = Math.min((profile.interests[theme] ?? 0) * .98 + weight, 12);
  }
  profile.places[id] = next;
  // Bound storage and let old weak signals fade instead of keeping a permanent history.
  const entries = Object.entries(profile.places).sort((a, b) => (b[1].seenAt ?? 0) - (a[1].seenAt ?? 0));
  profile.places = Object.fromEntries(entries.slice(0, 300));
  try { localStorage.setItem(profileKey, JSON.stringify(profile)); } catch {}
}

export function recentlySeen(profile: DiscoveryProfile, now = Date.now()) {
  return Object.entries(profile.places)
    .filter(([, history]) => history.seenAt && now - history.seenAt < 7 * 86_400_000)
    .sort((a, b) => (b[1].seenAt ?? 0) - (a[1].seenAt ?? 0))
    .slice(0, 48).map(([id]) => id);
}

export function favoriteTheme(profile: DiscoveryProfile): Exclude<DiscoveryTheme, "other"> | null {
  const themes = (["nature", "heritage", "family", "food"] as const).map(theme => ({ theme, value: profile.interests[theme] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  return themes[0].value >= 2 ? themes[0].theme : null;
}

export function rankPlaces<T extends PlaceCandidate>(candidates: T[], profile: DiscoveryProfile, now = Date.now()): T[] {
  const score = (place: T, index: number) => {
    const history = profile.places[place.id] ?? {};
    const age = history.seenAt ? now - history.seenAt : Infinity;
    const recentPenalty = age < 30 * 60_000 ? 7 : age < 24 * 3_600_000 ? 4 : age < 7 * 86_400_000 ? 1.5 : 0;
    const interest = Math.min(profile.interests[place.theme ?? "other"] ?? 0, 8) * .32;
    // Google's relevance and the local-distance selection remain the baseline.
    return -index * .13 + interest + Math.min(history.opens ?? 0, 3) * .3
      + (history.liked ? 1.1 : 0) + (history.saved ? 1.1 : 0) - recentPenalty;
  };
  const ordered = candidates.map((place, index) => ({ place, score: score(place, index), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const result: T[] = [];
  while (ordered.length) {
    const previous = result.slice(-2);
    const diverse = previous.length === 2 && previous[0].theme === previous[1].theme
      ? ordered.findIndex(item => item.place.theme !== previous[0].theme) : -1;
    result.push(ordered.splice(diverse >= 0 ? diverse : 0, 1)[0].place);
  }
  return result;
}
