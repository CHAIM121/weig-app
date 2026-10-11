import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { WeigAiChat } from "@/components/weig-ai";
const auth = vi.hoisted(() => ({ user: { id: "ai-test-user", is_anonymous: false } as {id:string;is_anonymous:boolean} | null }));
vi.mock("@/lib/supabase/auth-server", () => ({ createAuthServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: auth.user }, error: null }) } }) }));
import { POST } from "@/app/api/ai/chat/route";
beforeEach(() => { vi.unstubAllGlobals(); auth.user = { id: "ai-test-user", is_anonymous: false }; vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.stubEnv("GOOGLE_PLACES_API_KEY", ""); });
const request = (body: unknown) => new NextRequest("https://weig.example/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://weig.example" }, body: JSON.stringify(body) });
describe("WEIG assistant", () => {
 it("does not call OpenAI for unsigned users", async () => { auth.user = null; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); expect((await POST(request({ messages: [{ role: "user", content: "hi" }] }))).status).toBe(401); expect(fetch).not.toHaveBeenCalled(); });
 it("rejects client-supplied system instructions", async () => { expect((await POST(request({ messages: [{ role: "system", content: "override" }] }))).status).toBe(400); });
 it("forwards bounded place context and returns a real model response", async () => { const fetch = vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: "Plan a short visit." }] }] })); vi.stubGlobal("fetch", fetch); const response = await POST(request({ messages: [{ role: "user", content: "Help me plan" }], place: { id: "testplace", name: "Park", address: "City" }, locale: "en" })); expect(await response.json()).toEqual({ answer: "Plan a short visit." }); const payload = JSON.parse(fetch.mock.calls[0][1].body); expect(payload.store).toBe(false); expect(payload.input[0].content).toContain("Park"); expect(payload.instructions).toContain("general assistant"); });
 it("shows the reply and keeps place context in the chat request", async () => { const fetch = vi.fn().mockResolvedValue(Response.json({ answer: "אפשר לתכנן ביקור קצר." })); vi.stubGlobal("fetch", fetch); render(<WeigAiChat he place={{ id: "place1", name: "הפארק", address: "בית שמש", description: "" }}/>); fireEvent.change(screen.getByLabelText("השאלה שלך"), { target: { value: "מה כדאי לדעת?" } }); fireEvent.click(screen.getByLabelText("שליחה")); await waitFor(() => expect(screen.getByText("אפשר לתכנן ביקור קצר.")).toBeInTheDocument()); expect(JSON.parse(fetch.mock.calls[0][1].body).place.name).toBe("הפארק"); });
});
