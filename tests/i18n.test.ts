import {describe,expect,it} from "vitest";
import {dictionaries,getDictionary} from "@/i18n/dictionaries";
import {directionFor} from "@/i18n/routing";
describe("i18n",()=>{it("has matching typed dictionary shapes",()=>expect(Object.keys(dictionaries.he)).toEqual(Object.keys(dictionaries.en)));it("selects translated copy",()=>expect(getDictionary("he").nav.places).toBe("מקומות"));it("sets locale directions",()=>{expect(directionFor("he")).toBe("rtl");expect(directionFor("en")).toBe("ltr")})});
