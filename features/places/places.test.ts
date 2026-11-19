import { afterEach, describe, expect, it, vi } from "vitest";

import { findArea, PlaceSearchError } from "@/features/places";

afterEach(() => vi.unstubAllGlobals());

function nominatimReturns(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("area search", () => {
  it("returns the English area name and coordinates for a Seoul area", async () => {
    nominatimReturns([{ lat: "37.5382200", lon: "127.0074000", name: "Hannam-dong" }]);
    expect(await findArea("한남동")).toEqual({ name: "Hannam-dong", lat: 37.53822, lon: 127.0074 });
  });

  it("asks only within Seoul, in English, identifying the app", async () => {
    const fetchMock = nominatimReturns([]);
    await findArea("hannam");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const u = new URL(String(url));
    expect(u.searchParams.get("q")).toBe("hannam");
    expect(u.searchParams.get("bounded")).toBe("1");
    expect(u.searchParams.get("accept-language")).toBe("en");
    expect(new Headers(init.headers).get("User-Agent")).toMatch(/LockerRadar/);
  });

  it("returns null when no area matches", async () => {
    nominatimReturns([]);
    expect(await findArea("zzzz")).toBeNull();
  });

  it("throws when the search service fails, so it is not shown as no match", async () => {
    nominatimReturns({ error: "down" }, 503);
    await expect(findArea("hannam")).rejects.toBeInstanceOf(PlaceSearchError);
  });
});
