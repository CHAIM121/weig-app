import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthExperience } from "@/components/auth-experience";
import { ModuleExperience } from "@/components/module-experience";
import { getDictionary } from "@/i18n/dictionaries";

const t = getDictionary("en");

describe("Milestone 2 experiences", () => {
  it.each(["places", "expenses", "calls", "ai"] as const)("renders the %s product screen", (module) => {
    render(<ModuleExperience module={module} t={t} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("continues email authentication to the OTP state", () => {
    render(<AuthExperience t={t} />);
    fireEvent.change(screen.getByLabelText(t.auth.email), { target: { value: "demo@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: t.auth.send }));
    expect(screen.getByText(t.auth.codeTitle)).toBeInTheDocument();
  });

  it("adds an expense locally without claiming persistence", () => {
    render(<ModuleExperience module="expenses" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.expenses.add }));
    fireEvent.change(screen.getByLabelText(t.expenses.amount), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(t.expenses.description), { target: { value: "Local preview" } });
    fireEvent.click(screen.getByRole("button", { name: t.expenses.submit }));
    expect(screen.getByText("Local preview")).toBeInTheDocument();
  });
});
