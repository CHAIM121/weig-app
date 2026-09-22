import {render,screen} from "@testing-library/react";
import {describe,expect,it} from "vitest";
import {AppShell,destinations} from "@/components/layout/app-shell";
import {getDictionary} from "@/i18n/dictionaries";
describe("navigation",()=>{it("contains exactly four module destinations",()=>expect(destinations).toEqual(["places","expenses","calls","ai"]));it("localizes all links",()=>{render(<AppShell locale="en" dictionary={getDictionary("en")}><p>content</p></AppShell>);const nav=screen.getByRole("navigation");expect(nav.querySelectorAll("a")).toHaveLength(4);expect(screen.getByRole("link",{name:"Places"})).toHaveAttribute("href","/en/places")})});
