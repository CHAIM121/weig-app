import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlaceAutocomplete } from "@/components/place-autocomplete";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("debounces 400ms, requires 3 characters, reuses a typing token and discards it on selection", async () => {
  vi.useFakeTimers();
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ places: [{ id: "ChIJone", name: "Live result", address: "Live address", source: "google_places", mapsUrl: "https://maps.google.com" }] })));
  const select = vi.fn();
  const props = { onChange: vi.fn(), onSelect: select, onSearch: vi.fn(), locale: "he" as const, center: null };
  const { rerender } = render(<PlaceAutocomplete {...props} value="ab"/>);
  fireEvent.focus(screen.getByRole("combobox"));
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  expect(fetcher).not.toHaveBeenCalled();
  rerender(<PlaceAutocomplete {...props} value="abc"/>);
  await act(async () => { await vi.advanceTimersByTimeAsync(399); });
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  const first = new URL(String(fetcher.mock.calls[0][0]), "http://localhost").searchParams.get("sessionToken");
  rerender(<PlaceAutocomplete {...props} value="abcd"/>);
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  expect(new URL(String(fetcher.mock.calls[1][0]), "http://localhost").searchParams.get("sessionToken")).toBe(first);
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: "ChIJone" }), first);
  fireEvent.focus(screen.getByRole("combobox"));
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  expect(new URL(String(fetcher.mock.calls[2][0]), "http://localhost").searchParams.get("sessionToken")).not.toBe(first);
});
