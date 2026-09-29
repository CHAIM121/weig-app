import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthExperience } from "@/components/auth-experience";
import { ModuleExperience } from "@/components/module-experience";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
const t = getDictionary("en");

describe("Milestone 2 experiences", () => {
  it.each(["places", "expenses", "calls", "ai"] as const)("renders the %s product screen", async (module) => {
    render(<ModuleExperience module={module} t={t} />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("continues email authentication to the OTP state", () => {
    render(<AuthExperience t={t} locale="en" />);
    fireEvent.change(screen.getByLabelText(t.auth.email), { target: { value: "demo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: t.auth.send }));
    expect(screen.getByText(t.auth.codeTitle)).toBeInTheDocument();
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
    } finally {
      sessionStorage.removeItem("weig-places-state-en");
    }
  });

  it("keeps a feed like separate from saving a place", async () => {
    sessionStorage.setItem("weig-places-state-en", JSON.stringify({ city: "Tel Aviv", manualCity: true, view: "feed" }));
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ places: [{
      id: "place-one", name: "Place One", address: "Tel Aviv", mapsUrl: "https://maps.google.com/?q=Place+One", photoName: null,
    }] }), { status: 200 }));
    try {
      render(<ModuleExperience module="places" t={t} />);
      const like = await screen.findByRole("button", { name: "Like Place One" });
      const save = screen.getByRole("button", { name: "Save Place One" });
      fireEvent.click(like);
      expect(like).toHaveAttribute("aria-pressed", "true");
      expect(save).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(save);
      expect(save).toHaveAttribute("aria-pressed", "true");
    } finally {
      fetcher.mockRestore();
      sessionStorage.removeItem("weig-places-state-en");
      localStorage.removeItem("weig-liked-places");
      localStorage.removeItem("weig-saved-places");
    }
  });
});
