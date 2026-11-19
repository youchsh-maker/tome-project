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
