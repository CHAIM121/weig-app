import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthExperience } from "@/components/auth-experience";
import { ModuleExperience } from "@/components/module-experience";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/lib/supabase/auth-client", () => ({
  createAuthBrowserClient: () => {
    const query: any = {
      select: vi.fn(), eq: vi.fn(), lte: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
      upsert: vi.fn(), update: vi.fn(),
      then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    ["select", "eq", "lte", "order", "limit", "update"].forEach((key) => query[key].mockReturnValue(query));
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    query.upsert.mockResolvedValue({ data: null, error: null });
    return {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp: vi.fn().mockResolvedValue({ error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(() => query),
    };
  },
}));
const t = getDictionary("en");

describe("Milestone 2 experiences", () => {
  it.each(["places", "expenses", "calls", "ai"] as const)("renders the %s product screen", async (module) => {
    render(<ModuleExperience module={module} t={t} />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("continues email authentication to the sign-in-link state", async () => {
    render(<AuthExperience t={t} locale="en" />);
    fireEvent.change(screen.getByLabelText(t.auth.email), { target: { value: "demo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: t.auth.send }));
    expect(await screen.findByText(t.auth.codeTitle)).toBeInTheDocument();
    expect(screen.getByText(/Open the message and tap the link to sign in/)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.auth.code)).not.toBeInTheDocument();
  });

  it("adds an expense locally without claiming persistence", () => {
    render(<ModuleExperience module="expenses" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.expenses.add }));
    fireEvent.change(screen.getByLabelText(t.expenses.amount), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(t.expenses.description), { target: { value: "Local preview" } });
    fireEvent.click(screen.getByRole("dialog").querySelector("button[type=submit]")!);
    expect(screen.getByText("Local preview")).toBeInTheDocument();
  });

  it("restores the Places category and view after a reload", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({
      category: "stays", city: "Tel Aviv", query: "", view: "list",
    }));
    try {
      render(<ModuleExperience module="places" t={t} />);
      expect(await screen.findByRole("button", { name: "Hotels & stays" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    } finally {
      sessionStorage.removeItem("weig-places-state-en");
    }
  });

  it("keeps the Places controls visible while only the results are loading", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({ city: "Tel Aviv", manualCity: true, view: "feed" }));
    let finishRequest: ((response: Response) => void) | undefined;
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { finishRequest = resolve; }));
    try {
      const { container } = render(<ModuleExperience module="places" t={t} />);
      expect(await screen.findByRole("status", { name: "Finding places for you…" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: t.places.search })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "For you" })).toBeInTheDocument();
      expect(container.querySelector(".discover-loading-skeleton")).not.toBeInTheDocument();
      expect(container.querySelector(".discover-results-skeleton")).toBeInTheDocument();
    } finally {
      finishRequest?.(new Response(JSON.stringify({ places: [] }), { status: 200 }));
      fetcher.mockRestore();
      sessionStorage.removeItem("weig-places-state-en");
    }
  });

  it("opens a restored place dialog directly on the viewport layer", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({
      category: "all", city: "Tel Aviv", manualCity: true, query: "", view: "list",
      selected: { id: "saved-place", he: "Saved place", en: "Saved place", image: "/images/place-placeholder.svg", areaHe: "Tel Aviv", areaEn: "Tel Aviv", maps: "Saved place", type: "views" },
    }));
    try {
      render(<ModuleExperience module="places" t={t} />);
      const dialog = await screen.findByRole("dialog", { name: "Saved place" });
      expect(dialog.parentElement?.parentElement).toBe(document.body);
      expect(document.body.style.overflow).toBe("hidden");
      expect(screen.getByRole("button", { name: "I've been here" })).toBeInTheDocument();
    } finally {
      sessionStorage.removeItem("weig-places-state-en");
    }
  });

  it("keeps a feed like separate from saving a place", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({ city: "Tel Aviv", manualCity: true, view: "feed" }));
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ places: [{
      id: "place-one", name: "Place One", address: "Tel Aviv", mapsUrl: "https://maps.google.com/?q=Place+One", photoName: null,
    }] }), { status: 200 }));
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    try {
      render(<ModuleExperience module="places" t={t} />);
      const like = await screen.findByRole("button", { name: "Like Place One" });
      const save = screen.getByRole("button", { name: "Save Place One" });
      fireEvent.click(like);
      expect(like).toHaveAttribute("aria-pressed", "true");
      expect(save).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(save);
      expect(save).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(screen.getByRole("button", { name: "Share Place One" }));
      expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "http://localhost:3000/en/places?place=place-one" }));
    } finally {
      fetcher.mockRestore();
      sessionStorage.removeItem("weig-places-state-en");
      localStorage.removeItem("weig-liked-places");
      localStorage.removeItem("weig-saved-places");
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    }
  });

  it("opens a shared place directly even when it is not in the feed", async () => {
    window.history.replaceState({}, "", "/en/places?place=shared-123");
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({ city: "Tel Aviv", manualCity: true }));
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      if (String(input).includes("/api/places/summary")) return new Response(JSON.stringify({ place: {
        id: "shared-123", name: "Shared Place", address: "Haifa", mapsUrl: "https://maps.google.com/", photoName: null,
      } }), { status: 200 });
      return new Response(JSON.stringify({ places: [] }), { status: 200 });
    });
    try {
      render(<ModuleExperience module="places" t={t} />);
      expect(await screen.findByRole("dialog", { name: "Shared Place" })).toBeInTheDocument();
      expect(fetcher.mock.calls.some(([input]) => String(input).includes("/api/places/summary?id=shared-123"))).toBe(true);
    } finally {
      fetcher.mockRestore();
      window.history.replaceState({}, "", "/");
      sessionStorage.removeItem("weig-places-state-en");
    }
  });

  it("appends a new feed page when the user approaches the end", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({ city: "Tel Aviv", manualCity: true, view: "feed" }));
    let onIntersect: IntersectionObserverCallback = () => {};
    let observed = false;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { onIntersect = callback; }
      observe() { observed = true; } disconnect() {}
    });
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const page = new URL(String(input), "http://localhost").searchParams.get("page");
      const place = { id: page ? "place-two" : "place-one", name: page ? "Second Place" : "First Place", address: "Tel Aviv", mapsUrl: "https://maps.google.com/", photoName: null };
      return new Response(JSON.stringify({ places: [place], hasMore: !page }), { status: 200 });
    });
    try {
      render(<ModuleExperience module="places" t={t} />);
      expect(await screen.findByRole("heading", { name: "First Place" })).toBeInTheDocument();
      await waitFor(() => expect(observed).toBe(true));
      await act(async () => onIntersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
      expect(await screen.findByRole("heading", { name: "Second Place" })).toBeInTheDocument();
      expect(screen.getAllByRole("heading", { name: "First Place" })).toHaveLength(1);
      expect(fetcher.mock.calls.some(([input]) => String(input).includes("page=1") && String(input).includes("seen=place-one"))).toBe(true);
    } finally {
      fetcher.mockRestore();
      vi.unstubAllGlobals();
      sessionStorage.removeItem("weig-places-state-en");
    }
  });

  it("uses granted device location when an old manual city was left blank", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({ city: "", manualCity: true, view: "list", query: "old search" }));
    const original = navigator.geolocation;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 31.75, longitude: 34.99 } } as GeolocationPosition),
    } });
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ places: [{
      id: "nearby", name: "Nearby Place", address: "Beit Shemesh", photoName: null, mapsUrl: "https://maps.google.com/",
    }], hasMore: false }), { status: 200 }));
    try {
      render(<ModuleExperience module="places" t={t} />);
      expect(await screen.findByText("Nearby Place")).toBeInTheDocument();
      expect(fetcher.mock.calls.some(([input]) => String(input).includes("lat=31.75") && String(input).includes("lng=34.99"))).toBe(true);
      expect(fetcher.mock.calls.every(([input]) => !String(input).includes("old+search"))).toBe(true);
    } finally {
      fetcher.mockRestore();
      sessionStorage.removeItem("weig-places-state-en");
      localStorage.removeItem("weig-last-location");
      Object.defineProperty(navigator, "geolocation", { configurable: true, value: original });
    }
  });
});
