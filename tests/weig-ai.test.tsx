import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { WeigAiChat } from "@/components/weig-ai";
const auth = vi.hoisted(() => ({ user: { id: "ai-test-user", is_anonymous: false } as {id:string;is_anonymous:boolean} | null }));
vi.mock("@/lib/supabase/auth-server", () => ({ createAuthServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: auth.user }, error: null }) } }) }));
import { POST } from "@/app/api/ai/chat/route";
import { extractAnswer, searchPlaces } from "@/lib/ai/tools";
beforeEach(() => { vi.unstubAllGlobals(); auth.user = { id: "ai-test-user", is_anonymous: false }; vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.stubEnv("GOOGLE_PLACES_API_KEY", ""); });
const request = (body: unknown) => new NextRequest("https://weig.example/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://weig.example" }, body: JSON.stringify(body) });
describe("WEIG assistant", () => {
 it("enables web search and returns clickable citation ranges", async () => {
  auth.user!.id = "web-test";
  const fetch = vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: "Verified [1]", annotations: [{ type: "url_citation", start_index: 9, end_index: 12, url: "https://example.org", title: "Source" }] }] }] })); vi.stubGlobal("fetch", fetch);
  const response = await POST(request({ messages: [{ role: "user", content: "Current hours?" }] }));
  expect((await response.json()).citations[0].url).toBe("https://example.org");
  const payload = JSON.parse(fetch.mock.calls[0][1].body); expect(payload.tools).toContainEqual({ type: "web_search" }); expect(payload.reasoning.effort).toBe("low");
 });
 it("executes a place lookup and gives the result back to the model", async () => {
  auth.user!.id = "places-test"; vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-google");
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ output: [{ type: "function_call", name: "search_places", call_id: "call1", arguments: JSON.stringify({ query: "parks in London" }) }] })).mockResolvedValueOnce(Response.json({ places: [{ id: "park1", displayName: { text: "Park" } }] })).mockResolvedValueOnce(Response.json({ output: [{ content: [{ type: "output_text", text: "Found Park" }] }] })); vi.stubGlobal("fetch", fetch);
  expect((await (await POST(request({ messages: [{ role: "user", content: "Find a park in London" }] }))).json()).answer).toBe("Found Park");
  expect(fetch.mock.calls[1][0]).toBe("https://places.googleapis.com/v1/places:searchText");
  const payload = JSON.parse(fetch.mock.calls[2][1].body); expect(payload.input.at(-1).type).toBe("function_call_output"); expect(payload.input.at(-1).output).toContain("park1");
 });
 it("handles tool failures and rejects unsafe citation URLs", async () => {
  expect(await searchPlaces("invalid", "he", new AbortController().signal)).toEqual({ error: "INVALID_QUERY" });
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-google"); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
  expect(await searchPlaces('{"query":"parks London"}', "he", new AbortController().signal)).toEqual({ error: "PLACES_UNAVAILABLE" });
  expect(extractAnswer([{ content: [{ type: "output_text", text: "source", annotations: [{ type: "url_citation", start_index: 0, end_index: 6, url: "javascript:alert(1)", title: "bad" }] }] }]).citations).toEqual([]);
 });
 it("renders source annotations as inline links", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ answer: "Verified [1]", citations: [{ start: 9, end: 12, url: "https://example.org", title: "Source" }] })));
  render(<WeigAiChat he/>); fireEvent.change(screen.getByLabelText("השאלה שלך"), { target: { value: "מה פתוח?" } }); fireEvent.click(screen.getByLabelText("שליחה"));
  await waitFor(() => expect(screen.getByRole("link", { name: "[1]" })).toHaveAttribute("href", "https://example.org"));
 });
 it("does not call OpenAI for unsigned users", async () => { auth.user = null; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); expect((await POST(request({ messages: [{ role: "user", content: "hi" }] }))).status).toBe(401); expect(fetch).not.toHaveBeenCalled(); });
 it("rejects client-supplied system instructions", async () => { expect((await POST(request({ messages: [{ role: "system", content: "override" }] }))).status).toBe(400); });
 it("forwards bounded place context and returns a real model response", async () => { const fetch = vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: "Plan a short visit." }] }] })); vi.stubGlobal("fetch", fetch); const response = await POST(request({ messages: [{ role: "user", content: "Help me plan" }], place: { id: "testplace", name: "Park", address: "City" }, locale: "en" })); expect(await response.json()).toEqual({ answer: "Plan a short visit.", citations: [] }); const payload = JSON.parse(fetch.mock.calls[0][1].body); expect(payload.store).toBe(false); expect(payload.input[0].content).toContain("Park"); expect(payload.instructions).toContain("general assistant"); });
 it("shows the reply and keeps place context in the chat request", async () => { const fetch = vi.fn().mockResolvedValue(Response.json({ answer: "אפשר לתכנן ביקור קצר." })); vi.stubGlobal("fetch", fetch); render(<WeigAiChat he place={{ id: "place1", name: "הפארק", address: "בית שמש", description: "" }}/>); fireEvent.change(screen.getByLabelText("השאלה שלך"), { target: { value: "מה כדאי לדעת?" } }); fireEvent.click(screen.getByLabelText("שליחה")); await waitFor(() => expect(screen.getByText("אפשר לתכנן ביקור קצר.")).toBeInTheDocument()); expect(JSON.parse(fetch.mock.calls[0][1].body).place.name).toBe("הפארק"); });
});
