export type NavigationPreference = "waze" | "google" | "both";

export const NAVIGATION_PREFERENCE_KEY = "weig-navigation-preference-v1";
export const NAVIGATION_PREFERENCE_EVENT = "weig-navigation-preference-change";

export function readNavigationPreference(): NavigationPreference {
  if (typeof window === "undefined") return "waze";
  const value = window.localStorage.getItem(NAVIGATION_PREFERENCE_KEY);
  return value === "google" || value === "both" ? value : "waze";
}

export function saveNavigationPreference(value: NavigationPreference) {
  window.localStorage.setItem(NAVIGATION_PREFERENCE_KEY, value);
  window.dispatchEvent(new CustomEvent(NAVIGATION_PREFERENCE_EVENT, { detail: value }));
}
