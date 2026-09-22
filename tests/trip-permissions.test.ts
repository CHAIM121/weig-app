import {describe,expect,it} from "vitest";
type Membership={userId:string;role:"owner"|"member"};
const canManage=(userId:string,members:Membership[])=>members.some(m=>m.userId===userId&&m.role==="owner");
describe("trip permissions contract",()=>{it("allows owners to manage",()=>expect(canManage("a",[{userId:"a",role:"owner"}])).toBe(true));it("does not allow members or strangers",()=>{expect(canManage("b",[{userId:"b",role:"member"}])).toBe(false);expect(canManage("c",[])).toBe(false)})});
