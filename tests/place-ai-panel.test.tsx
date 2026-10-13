import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlaceAiButton, PlaceAiDialog } from "@/components/weig-ai";

afterEach(()=>vi.unstubAllGlobals());
function media(mobile:boolean){
 vi.stubGlobal("matchMedia",()=>({matches:mobile,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
}
const place={id:"park",name:"הפארק",address:"בית שמש",description:""};
describe("contextual place assistant",()=>{
 it("opens beside the content without blocking desktop scrolling and restores trigger focus",()=>{
  media(false);
  const close=vi.fn();
  const {unmount}=render(<><PlaceAiButton he name={place.name} onClick={()=>{}}/><PlaceAiDialog he place={place} close={close}/></>);
  expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal","true");
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(screen.getByLabelText("השאלה שלך")).toHaveFocus();
  fireEvent.keyDown(document,{key:"Escape"});expect(close).toHaveBeenCalledOnce();
  unmount();
 });
 it("locks mobile background scrolling, traps keyboard focus and preserves context in a new conversation",()=>{
  media(true);
  const {unmount}=render(<PlaceAiDialog he place={place} close={vi.fn()}/>);
  expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal","true");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(screen.getByLabelText("שיחה חדשה"));expect(screen.getByText(place.name)).toBeInTheDocument();
  const first=screen.getByLabelText("שיחה חדשה"),textarea=screen.getByLabelText("השאלה שלך");
  first.focus();fireEvent.keyDown(document,{key:"Tab",shiftKey:true});expect(textarea).toHaveFocus();
  unmount();expect(document.body.style.overflow).not.toBe("hidden");
 });
});
