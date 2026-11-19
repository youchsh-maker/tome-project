import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import Home from "@/app/page";

function apiReturns(items: Record<string, unknown>[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ response: { header: { resultCode: "00" }, body: { items: { item: items } } } }),
    ),
  );
}

async function renderHome(q?: string) {
  render(await Home({ searchParams: Promise.resolve(q ? { q } : {}), params: Promise.resolve({}) } as PageProps<"/">));
}

beforeEach(() => vi.stubEnv("DATA_GO_KR_KEY", "test-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("shows the English search form before any search", async () => {
  await renderHome();
  expect(screen.getByRole("heading", { level: 1, name: /Find a free locker/ })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Station name" })).toBeInTheDocument();
});

test("suggests matching stations by official English name, excluding Line 9", async () => {
  apiReturns([
    { lckrId: "A", stnNm: "강남", lineNm: "2호선" },
    { lckrId: "B", stnNm: "강남구청", lineNm: "7호선" },
    { lckrId: "C", stnNm: "언주", lineNm: "9호선" },
  ]);
  await renderHome("gang");
  const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/stations/"));
  expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["Gangnam", "/stations/gangnam"],
    ["Gangnamgu Office", "/stations/gangnamgu-office"],
  ]);
  expect(screen.queryByText(/Eonju/)).not.toBeInTheDocument();
});

test("shows an English error with a retry link when the data service fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
  await renderHome("gang");
  expect(screen.getByText(/couldn.t load locker data/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?q=gang");
  expect(screen.queryByText(/No Seoul Metro station matches/)).not.toBeInTheDocument();
});

function routeFetch(lockers: Record<string, unknown>[], area: unknown, areaStatus = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) =>
      String(input).includes("nominatim")
        ? Response.json(area, { status: areaStatus })
        : Response.json({ response: { header: { resultCode: "00" }, body: { items: { item: lockers } } } }),
    ),
  );
}

const FREE = { usePsbltyLrtypeLckrCnt: 1, usePsbltyMdtypeLckrCnt: 0, usePsbltySmttypeLckrCnt: 0 };

test("for an area name that is not a station, lists the nearest free lockers with distance", async () => {
  routeFetch(
    [
      { lckrId: "HG", stnNm: "한강진", lineNm: "6호선", LAT: 37.5397, LOT: 127.0018, ...FREE },
      { lckrId: "IT", stnNm: "이태원", lineNm: "6호선", LAT: 37.5345, LOT: 126.9946, ...FREE },
      { lckrId: "GN", stnNm: "강남", lineNm: "2호선", LAT: 37.4979, LOT: 127.0276, ...FREE },
    ],
    [{ lat: "37.53822", lon: "127.0074", name: "Hannam-dong" }],
  );
  await renderHome("한남동");
  const region = screen.getByRole("region", { name: "Lockers near Hannam-dong" });
  const hrefs = Array.from(region.querySelectorAll("a[href^='/stations/']")).map((a) => a.getAttribute("href"));
  expect(hrefs).toEqual([
    "/stations/hangangjin/lockers/HG",
    "/stations/itaewon/lockers/IT",
    "/stations/gangnam/lockers/GN",
  ]);
  expect(region.textContent).toMatch(/Hangangjin/);
  expect(region.textContent).toMatch(/\d+(\.\d)? k?m/);
});

test("shows an English error with retry when the area search service fails", async () => {
  routeFetch([{ lckrId: "GN", stnNm: "강남", lineNm: "2호선", ...FREE }], { error: "down" }, 503);
  await renderHome("hannam");
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?q=hannam");
});
