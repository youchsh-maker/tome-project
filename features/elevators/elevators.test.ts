import { describe, expect, it } from "vitest";

import { normalizeElevators } from "@/features/elevators";

function raw(over: Record<string, unknown> = {}) {
  return {
    fcltNo: "1042202",
    stnNm: "강남",
    lineNm: "2호선",
    vcntEntrcNo: "1",
    dtlPstn: "1번 출입구",
    bgngFlrGrndUdgdSe: "지하",
    bgngFlr: "B1",
    endFlrGrndUdgdSe: "지상",
    endFlr: "1",
    oprtngSitu: "M",
    ...over,
  };
}

describe("station elevators", () => {
  it("shows the nearest exit, floors, and status in English with the Korean location", () => {
    expect(normalizeElevators([raw()], "강남")).toEqual([
      {
        id: "1042202",
        exit: "Exit 1",
        floors: "B1 → Ground",
        status: "in-service",
        statusLabel: "In service",
        detailKo: "1번 출입구",
      },
    ]);
  });

  it("keeps only the chosen station, not partial-name matches", () => {
    const ids = normalizeElevators([raw(), raw({ fcltNo: "X", stnNm: "강남구청" })], "강남").map((e) => e.id);
    expect(ids).toEqual(["1042202"]);
  });

  it("formats multiple exits and exits written in Korean", () => {
    const list = normalizeElevators(
      [
        raw({ fcltNo: "a", vcntEntrcNo: "1,10" }),
        raw({ fcltNo: "b", vcntEntrcNo: "9번 출입구" }),
        raw({ fcltNo: "c", vcntEntrcNo: "2번출구" }),
      ],
      "강남",
    );
    expect(list.map((e) => e.exit)).toEqual(["Exits 1, 10", "Exit 9", "Exit 2"]);
  });

  it("labels an in-station elevator without an exit", () => {
    const [e] = normalizeElevators(
      [raw({ vcntEntrcNo: "내부", bgngFlr: "B2", endFlrGrndUdgdSe: "지하", endFlr: "B1" })],
      "강남",
    );
    expect(e).toMatchObject({ exit: "Inside the station", floors: "B2 → B1" });
  });

  it("shows upper above-ground floors as nF", () => {
    const [e] = normalizeElevators(
      [raw({ bgngFlrGrndUdgdSe: "지상", bgngFlr: "1", endFlrGrndUdgdSe: "지상", endFlr: "2" })],
      "강남",
    );
    expect(e.floors).toBe("Ground → 2F");
  });

  it("distinguishes out-of-service and unknown status", () => {
    const list = normalizeElevators([raw({ fcltNo: "s", oprtngSitu: "S" }), raw({ fcltNo: "n", oprtngSitu: null })], "강남");
    expect(list.map((e) => [e.status, e.statusLabel])).toEqual([
      ["out-of-service", "Out of service"],
      ["unknown", "Status unknown"],
    ]);
  });
});
