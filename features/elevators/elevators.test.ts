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
  it("shows a street exit elevator from street level down, with English and Korean location", () => {
    expect(normalizeElevators([raw()], "강남")).toEqual([
      {
        id: "1042202",
        kind: "exit",
        exit: "Exit 1",
        exits: ["1"],
        floors: "Ground → B1",
        arrivesAt: "B1",
        status: "in-service",
        statusLabel: "In service",
        detailEn: "Exit 1",
        detailKo: "1번 출입구",
      },
    ]);
  });

  it("shows a platform elevator from the platform up, with where to get off the train", () => {
    const [e] = normalizeElevators(
      [raw({ vcntEntrcNo: "내부", dtlPstn: "역삼 방면8-1", bgngFlr: "B1", endFlrGrndUdgdSe: "지하", endFlr: "B2" })],
      "강남",
    );
    expect(e).toMatchObject({ kind: "platform", floors: "B2 → B1", detailEn: "Door 8-1 (train toward Yeoksam)" });
  });

  it("has no English location for a sentence missing from the translation table", () => {
    expect(normalizeElevators([raw({ dtlPstn: "새로 생긴 위치" })], "강남")[0].detailEn).toBeNull();
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
    expect(e).toMatchObject({ kind: "platform", exit: "Inside the station", floors: "B2 → B1" });
  });

  it("shows an elevated platform as nF, from the platform down", () => {
    const [e] = normalizeElevators(
      [raw({ vcntEntrcNo: "내부", bgngFlrGrndUdgdSe: "지상", bgngFlr: "1", endFlrGrndUdgdSe: "지상", endFlr: "2" })],
      "강남",
    );
    expect(e.floors).toBe("2F → Ground");
  });

  it("uses the operator's exterior/interior label in the facility name before guessing from the exit field", () => {
    const [street, platform] = normalizeElevators(
      [
        raw({ fcltNo: "a", fcltNm: "승강기)엘리베이터-종로5가 8,9번 출입구 외부#1", mngNo: "외부#1", vcntEntrcNo: "내부" }),
        raw({ fcltNo: "b", fcltNm: "승강기)엘리베이터-남태령 1번 출구측 내부#2", mngNo: "내부#2", vcntEntrcNo: "1" }),
      ],
      "강남",
    );
    expect([street.kind, platform.kind]).toEqual(["exit", "platform"]);
  });

  it("exposes exit numbers and the floor the elevator arrives at in the station", () => {
    const [exit, platform] = normalizeElevators(
      [
        raw({ fcltNo: "e", vcntEntrcNo: "1,10" }),
        raw({ fcltNo: "p", vcntEntrcNo: "내부", bgngFlr: "B3", endFlrGrndUdgdSe: "지하", endFlr: "B2" }),
      ],
      "강남",
    );
    expect([exit.exits, exit.arrivesAt]).toEqual([["1", "10"], "B1"]);
    expect([platform.exits, platform.arrivesAt]).toEqual([[], "B2"]);
  });

  it("distinguishes out-of-service and unknown status", () => {
    const list = normalizeElevators([raw({ fcltNo: "s", oprtngSitu: "S" }), raw({ fcltNo: "n", oprtngSitu: null })], "강남");
    expect(list.map((e) => [e.status, e.statusLabel])).toEqual([
      ["out-of-service", "Out of service"],
      ["unknown", "Status unknown"],
    ]);
  });
});
