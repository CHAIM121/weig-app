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
});
