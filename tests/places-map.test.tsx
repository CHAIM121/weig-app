import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GooglePlacesMap } from "@/components/google-places-map";

const places = [
  { id: "first", he: "מקום ראשון", en: "First place", areaHe: "נתניה", areaEn: "Netanya", location: { latitude: 32.33, longitude: 34.86 } },
  { id: "second", he: "מקום שני", en: "Second place", areaHe: "נתניה", areaEn: "Netanya", location: { latitude: 32.34, longitude: 34.87 } },
];
const markerClicks: (() => void)[] = [];
const panTo = vi.fn();
const props = { places, he: true, center: null, city: "נתניה", onSelect: vi.fn() };
beforeEach(() => {
  markerClicks.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLElement.prototype.scrollBy = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("discovery map", () => {
  it("keeps cards and details available without a browser map key", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    render(<GooglePlacesMap {...props}/>);
    fireEvent.click(screen.getByRole("button", { name: /מקום שני נתניה 2/ }));
    expect(screen.getByTitle("מפת Google Maps")).toHaveAttribute("src", expect.stringContaining("q=" + new URLSearchParams({ q: "מקום שני" }).toString().slice(2)));
    fireEvent.click(screen.getByRole("button", { name: "פרטים על מקום שני" }));
    expect(props.onSelect).toHaveBeenCalledWith(places[1]);
  });
  it("restores scrolling and keyboard focus after leaving full screen", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    render(<GooglePlacesMap {...props}/>);
    const expand = screen.getByRole("button", { name: "מפה במסך מלא" });
    fireEvent.click(expand);
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(expand).toHaveFocus();
  });
  it("selects the matching card from a marker and cleans up markers on unmount", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-public-map-key");
    const remove = vi.fn();
    vi.stubGlobal("google", { maps: {
      Map: class { panTo = panTo; fitBounds() {} setZoom() {} },
      Marker: class { setMap = remove; setIcon() {} setZIndex() {} addListener(_name: string, click: () => void) { markerClicks.push(click); } },
      LatLngBounds: class { extend() {} }, SymbolPath: { CIRCLE: 0 }, event: { trigger() {}, clearInstanceListeners() {} },
    } });
    const { unmount } = render(<GooglePlacesMap {...props}/>);
    await waitFor(() => expect(markerClicks).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: /מקום שני נתניה 2/ }));
    expect(panTo).toHaveBeenLastCalledWith({ lat: 32.34, lng: 34.87 });
    markerClicks[0]();
    await waitFor(() => expect(screen.getByRole("button", { name: /מקום ראשון נתניה 1/ })).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "פרטים על מקום ראשון" }));
    expect(props.onSelect).toHaveBeenCalledWith(places[0]);
    unmount();
    expect(remove).toHaveBeenCalledWith(null);
  });
});
