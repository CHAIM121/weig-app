import {fireEvent,render,screen} from "@testing-library/react";
import {describe,expect,it} from "vitest";
import {AppShell,destinations} from "@/components/layout/app-shell";
import {getDictionary} from "@/i18n/dictionaries";
import {NAVIGATION_PREFERENCE_KEY} from "@/modules/places/navigation-preference";

describe("navigation",()=>{
 it("contains exactly four module destinations",()=>expect(destinations).toEqual(["places","expenses","calls","ai"]));
 it("localizes all links",()=>{render(<AppShell locale="en" dictionary={getDictionary("en")}><p>content</p></AppShell>);const nav=screen.getByRole("navigation");expect(nav.querySelectorAll("a")).toHaveLength(4);expect(screen.getByRole("link",{name:"Places"})).toHaveAttribute("href","/en/places")});
 it("saves the user's preferred navigation apps",()=>{
  render(<AppShell locale="en" dictionary={getDictionary("en")}><p>content</p></AppShell>);
  fireEvent.click(screen.getByRole("button",{name:"Menu"}));
  fireEvent.click(screen.getByRole("button",{name:/Settings/}));
  const both=screen.getByRole("button",{name:"Both"});
  fireEvent.click(both);
  expect(both).toHaveAttribute("aria-pressed","true");
  expect(localStorage.getItem(NAVIGATION_PREFERENCE_KEY)).toBe("both");
  localStorage.removeItem(NAVIGATION_PREFERENCE_KEY);
 });
});
