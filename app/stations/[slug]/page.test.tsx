import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import StationPage from "@/app/stations/[slug]/page";

const NONE = { usePsbltyLrtypeLckrCnt: 0, usePsbltyMdtypeLckrCnt: 0, usePsbltySmttypeLckrCnt: 0 };
const SOME = { usePsbltyLrtypeLckrCnt: 1, usePsbltyMdtypeLckrCnt: 0, usePsbltySmttypeLckrCnt: 2 };

function locker(id: string, stnNm: string, lat: number, lon: number, counts: Record<string, number>) {
  return { lckrId: id, stnNm, lineNm: "2호선", lckrRprsLocNm: `2호선 ${stnNm}`, LAT: lat, LOT: lon, totCrtrDt: "2026-11-19T12:30:06", ...counts };
}

beforeEach(() => {
  vi.stubEnv("DATA_GO_KR_KEY", "test-key");
  const items = [
    locker("G", "강남", 37.4979, 127.0276, NONE),
    locker("SEOLLEUNG", "선릉", 37.5045, 127.049, SOME),
    locker("YEOKSAM", "역삼", 37.5006, 127.0364, SOME),
    locker("SAMSEONG", "삼성", 37.5088, 127.0631, SOME),
    locker("GYODAE", "교대", 37.4934, 127.0142, SOME),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ response: { header: { resultCode: "00" }, body: { items: { item: items } } } })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("when no locker at the station is free, says so first and lists the 3 nearest free lockers with distance", async () => {
  const { container } = render(
    await StationPage({ params: Promise.resolve({ slug: "gangnam" }) } as PageProps<"/stations/[slug]">),
  );

  const notice = screen.getByText("No free compartments at Gangnam right now");
  const nearby = screen.getByRole("region", { name: "Nearby free lockers" });
  expect(notice.compareDocumentPosition(nearby) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  const titles = within(nearby)
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"));
  expect(titles).toEqual([
    "/stations/yeoksam/lockers/YEOKSAM",
    "/stations/seoul-nat-l-univ-of-education-court-prosecutors-office/lockers/GYODAE",
    "/stations/seolleung/lockers/SEOLLEUNG",
  ]);
  expect(within(nearby).getAllByText(/\d+(\.\d)? k?m away/)).toHaveLength(3);
  expect(container.textContent).not.toMatch(/Samseong/);
});
