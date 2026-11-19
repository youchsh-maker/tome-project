import { describe, expect, it } from "vitest";

import {
  describeFilter,
  filterFrom,
  filterQuery,
  findFreeNear,
  summarizeByStation,
  findNearbyFree,
  formatDistance,
  formatUpdatedAt,
  hasFree,
  normalizeLockers,
  todayFor,
} from "@/features/lockers";

// Real T-Locker fee text from the 2026-11-19 API response, including the stray space in "기 본요금".
const FEE =
  "・ 4시간 기본요금 부과 이후 1시간당 추가요금발생\r\n・ 맡길 때 기본요금 결제, 찾을 때 추가요금 결제\r\n\r\n・ 주중 요금(월-금) : \r\n소형: 기본요금 2,200원, 추가요금 500원\r\n중형: 기 본요금 3,300원, 추가요금 800원\r\n대형: 기본요금 4,400원, 추가요금 1,000원\r\n\r\n・ 주말 요금(토, 일) :\r\n소형: 기본요금 3,100원, 추가요금 500원\r\n중형: 기본요금 4,600원, 추가요금 800원\r\n대형: 기본요금 6,100원, 추가요금 1,000원";

function raw(over: Record<string, unknown> = {}) {
  return {
    lckrId: "TL222A",
    stnNm: "강남",
    lineNm: "2호선",
    stnCd: "0222",
    lckrRprsLocNm: "2호선 강남(1~52)",
    lckrDtlLocNm: "1번 출입구 통로",
    usePsbltyLrtypeLckrCnt: 3,
    usePsbltyMdtypeLckrCnt: 8,
    usePsbltySmttypeLckrCnt: 31,
    LAT: 37.49813,
    LOT: 127.028403,
    wkdayOperBgngTm: "050000",
    wkdayOperEndTm: "010000",
    satOperBgngTm: "060000",
    satOperEndTm: "230000",
    lhldyOperBgngTm: "050000",
    lhldyOperEndTm: "000000",
    utztnCrgExpln: FEE,
    totCrtrDt: "2026-11-19T12:30:06",
    lckrWdthLenExpln: "・ 소형 : 50(cm)\r\n・ 중형 : 50(cm)\r\n・ 대형 : 50(cm)",
    lckrDpthExpln: "・ 소형 : 60(cm)\r\n・ 중형 : 60(cm)\r\n・ 대형 : 60(cm)",
    lckrHgtExpln: "・ 소형 : 30(cm)\r\n・ 중형 : 45(cm)\r\n・ 대형 : 90(cm)",
    ...over,
  };
}

const NONE = { usePsbltyLrtypeLckrCnt: 0, usePsbltyMdtypeLckrCnt: 0, usePsbltySmttypeLckrCnt: 0 };

// 2026-11-19 is a Thursday, 2026-11-21 a Saturday, 2026-11-22 a Sunday (noon KST).
const THU = new Date("2026-11-19T03:00:00Z");
const SAT = new Date("2026-11-21T03:00:00Z");
const SUN = new Date("2026-11-22T03:00:00Z");

describe("locker normalization", () => {
  it("keeps the representative location and free counts per size", () => {
    const [l] = normalizeLockers([raw()]);
    expect(l).toMatchObject({
      id: "TL222A",
      stationKo: "강남",
      name: "2호선 강남(1~52)",
      detailKo: "1번 출입구 통로",
      available: { Large: 3, Medium: 8, Small: 31 },
    });
  });

  it("adds the English location from the translation table, or null when the sentence is not in it", () => {
    const [known, unknown] = normalizeLockers([raw(), raw({ lckrId: "N", lckrDtlLocNm: "새로 생긴 위치" })]);
    expect(known.detailEn).toBe("Passage at Exit 1");
    expect(unknown.detailEn).toBeNull();
  });

  it("marks lockers whose usage text says they are opened with the T-Locker app", () => {
    const [tLocker, other] = normalizeLockers([
      raw({ useMthdExpln: "또타라커 (T-Locker) 이용 방법 \r\n\r\n・ 보관\r\n\r\n1. 또타라커 (T-Locker) 앱 설치" }),
      raw({ lckrId: "COIN", useMthdExpln: "카드 결제 후 보관함 이용" }),
    ]);
    expect([tLocker.usesTLocker, other.usesTLocker]).toEqual([true, false]);
  });

  it("excludes Line 9 lockers, which are outside the service scope", () => {
    const ids = normalizeLockers([raw({ lineNm: "9호선", lckrId: "X" }), raw()]).map((l) => l.id);
    expect(ids).toEqual(["TL222A"]);
  });

  it("shows the data timestamp in KST", () => {
    expect(formatUpdatedAt(normalizeLockers([raw()])[0])).toBe("2026-11-19 12:30 KST");
  });
});

describe("compartment sizes", () => {
  it("shows width × depth × height in cm for each size", () => {
    expect(normalizeLockers([raw()])[0].dimensions).toEqual({
      Large: "50 × 60 × 90 cm",
      Medium: "50 × 60 × 45 cm",
      Small: "50 × 60 × 30 cm",
    });
  });

  it("omits a size whose dimensions cannot be read", () => {
    const [l] = normalizeLockers([raw({ lckrHgtExpln: "・ 소형 : 30(cm)\r\n・ 중형 : 45(cm)" })]);
    expect(l.dimensions).toEqual({ Medium: "50 × 60 × 45 cm", Small: "50 × 60 × 30 cm" });
  });
});

describe("route hints from the Korean location", () => {
  const hints = (text: string) => {
    const [l] = normalizeLockers([raw({ lckrDtlLocNm: text })]);
    return { exits: l.exits, floor: l.floor, gates: l.gates };
  };

  it("reads exit numbers, ranges, and the floor", () => {
    expect(hints("지하2층 4.6번 출구 방면 고객안전실 옆")).toEqual({ exits: ["4", "6"], floor: "B2", gates: null });
    expect(hints("지하1층 대합실 3~5번 출구 방면")).toEqual({ exits: ["3", "4", "5"], floor: "B1", gates: null });
    expect(hints("화곡역 B1층 3,4번 출구 방면")).toMatchObject({ exits: ["3", "4"], floor: "B1" });
  });

  it("reads whether the locker is inside or outside the ticket gates", () => {
    expect(hints("10번 출입구 게이트 내부").gates).toBe("inside");
    expect(hints("1번 출입구 9호선 환승게이트 주변(게이트 안)").gates).toBe("inside");
    expect(hints("2번 출입구 게이트 밖").gates).toBe("outside");
    expect(hints("1,2번 출입구 사이 게이트 주변").gates).toBeNull();
  });

  it("leaves hints empty when the sentence has none", () => {
    expect(hints("대합실")).toEqual({ exits: [], floor: null, gates: null });
  });
});

describe("availability", () => {
  it("counts a locker with at least one free compartment of any size as free", () => {
    const [l] = normalizeLockers([raw({ ...NONE, usePsbltySmttypeLckrCnt: 1 })]);
    expect(hasFree(l)).toBe(true);
  });

  it("with a size filter, counts only free compartments of that size", () => {
    const [smallOnly] = normalizeLockers([raw({ ...NONE, usePsbltySmttypeLckrCnt: 5 })]);
    const [oneLarge] = normalizeLockers([raw({ ...NONE, usePsbltyLrtypeLckrCnt: 1 })]);
    expect([hasFree(smallOnly, { size: "Large", min: 1 }), hasFree(oneLarge, { size: "Large", min: 1 })]).toEqual([false, true]);
  });

  it("with a minimum count, needs at least that many free compartments of the size, or in total for any size", () => {
    const [l] = normalizeLockers([raw({ usePsbltyLrtypeLckrCnt: 2, usePsbltyMdtypeLckrCnt: 0, usePsbltySmttypeLckrCnt: 1 })]);
    expect(hasFree(l, { size: "Large", min: 2 })).toBe(true);
    expect(hasFree(l, { size: "Large", min: 3 })).toBe(false);
    expect(hasFree(l, { min: 3 })).toBe(true);
    expect(hasFree(l, { min: 5 })).toBe(false);
  });

  it("treats all-zero counts as no free compartment", () => {
    const [l] = normalizeLockers([raw(NONE)]);
    expect(hasFree(l)).toBe(false);
  });
});

describe("today's fee and hours", () => {
  const [l] = normalizeLockers([raw()]);

  it("extracts weekday fees per size in English and won", () => {
    expect(todayFor(l, THU).fees).toEqual([
      "Large ₩4,400 / 4h, +₩1,000/h",
      "Medium ₩3,300 / 4h, +₩800/h",
      "Small ₩2,200 / 4h, +₩500/h",
    ]);
  });

  it("uses weekend fees on Saturday", () => {
    expect(todayFor(l, SAT).fees?.[0]).toBe("Large ₩6,100 / 4h, +₩1,000/h");
  });

  it("returns null fees when the fee text cannot be parsed, so the original is shown", () => {
    const [odd] = normalizeLockers([raw({ utztnCrgExpln: "요금은 현장 문의" })]);
    expect(todayFor(odd, THU).fees).toBeNull();
    expect(odd.feeRaw).toBe("요금은 현장 문의");
  });

  it("shows weekday, Saturday, and Sunday hours", () => {
    expect(todayFor(l, THU).hours).toBe("05:00–01:00");
    expect(todayFor(l, SAT).hours).toBe("06:00–23:00");
    expect(todayFor(l, SUN).hours).toBe("05:00–00:00");
  });
});

describe("nearby fallback", () => {
  const lockers = normalizeLockers([
    raw({ lckrId: "G", stnNm: "강남", LAT: 37.4979, LOT: 127.0276, ...NONE }),
    raw({ lckrId: "SEOLLEUNG", stnNm: "선릉", LAT: 37.5045, LOT: 127.049 }),
    raw({ lckrId: "YEOKSAM", stnNm: "역삼", LAT: 37.5006, LOT: 127.0364 }),
    raw({ lckrId: "SAMSEONG", stnNm: "삼성", LAT: 37.5088, LOT: 127.0631 }),
    raw({ lckrId: "GYODAE", stnNm: "교대", LAT: 37.4934, LOT: 127.0142 }),
    raw({ lckrId: "FULL", stnNm: "역삼", LAT: 37.5006, LOT: 127.0365, ...NONE }),
  ]);

  it("returns up to three free lockers at other stations, nearest first", () => {
    expect(findNearbyFree(lockers, "강남").map((n) => n.locker.id)).toEqual(["YEOKSAM", "GYODAE", "SEOLLEUNG"]);
  });

  it("reports straight-line distance (Gangnam to Yeoksam is about 0.8 km)", () => {
    const [first] = findNearbyFree(lockers, "강남");
    expect(first.distanceM).toBeGreaterThan(700);
    expect(first.distanceM).toBeLessThan(900);
  });

  it("finds free lockers nearest to a point such as an area center", () => {
    const near = findFreeNear(lockers, { lat: 37.5006, lon: 127.0364 }, 2);
    expect(near.map((n) => n.locker.id)).toEqual(["YEOKSAM", "SEOLLEUNG"]);
    expect(near[0].distanceM).toBeLessThan(10);
  });

  it("with a size filter, skips nearby lockers without that size free", () => {
    const sized = normalizeLockers([
      raw({ lckrId: "G", stnNm: "강남", LAT: 37.4979, LOT: 127.0276, ...NONE }),
      raw({ lckrId: "YEOKSAM_SMALL", stnNm: "역삼", LAT: 37.5006, LOT: 127.0364, ...NONE, usePsbltySmttypeLckrCnt: 4 }),
      raw({ lckrId: "GYODAE_LARGE", stnNm: "교대", LAT: 37.4934, LOT: 127.0142, ...NONE, usePsbltyLrtypeLckrCnt: 2 }),
    ]);
    expect(findNearbyFree(sized, "강남", 3, { size: "Large", min: 1 }).map((n) => n.locker.id)).toEqual(["GYODAE_LARGE"]);
    expect(findFreeNear(sized, { lat: 37.5006, lon: 127.0364 }, 5, { size: "Large", min: 1 }).map((n) => n.locker.id)).toEqual([
      "GYODAE_LARGE",
    ]);
  });

  it("formats distance in m or km", () => {
    expect(formatDistance(812)).toBe("810 m");
    expect(formatDistance(1530)).toBe("1.5 km");
    expect(formatDistance(997)).toBe("1.0 km");
  });
});

describe("station summary for the overview map", () => {
  it("adds up free compartments per station across its lockers", () => {
    const summary = summarizeByStation(
      normalizeLockers([
        raw({ lckrId: "A", stnNm: "강남", LAT: 37.49, LOT: 127.02, usePsbltyLrtypeLckrCnt: 1, usePsbltyMdtypeLckrCnt: 2, usePsbltySmttypeLckrCnt: 3 }),
        raw({ lckrId: "B", stnNm: "강남", LAT: 37.5, LOT: 127.03, usePsbltyLrtypeLckrCnt: 0, usePsbltyMdtypeLckrCnt: 1, usePsbltySmttypeLckrCnt: 4 }),
        raw({ lckrId: "C", stnNm: "역삼", LAT: 37.5, LOT: 127.04, ...NONE }),
      ]),
    );
    expect(summary).toEqual([
      { stationKo: "강남", lat: 37.495, lon: 127.025, available: { Large: 1, Medium: 3, Small: 7 }, total: 11 },
      { stationKo: "역삼", lat: 37.5, lon: 127.04, available: { Large: 0, Medium: 0, Small: 0 }, total: 0 },
    ]);
  });
});

describe("search filter in the address", () => {
  it("reads size and minimum count, ignoring values that are not offered", () => {
    expect(filterFrom({ size: "large", min: "2" })).toEqual({ size: "Large", min: 2 });
    expect(filterFrom({ size: "small" })).toEqual({ size: "Small", min: 1 });
    expect(filterFrom({ min: "5" })).toEqual({ min: 5 });
    expect(filterFrom({ size: "huge", min: "4" })).toBeUndefined();
    expect(filterFrom({})).toBeUndefined();
  });

  it("keeps the filter in links and describes it in English", () => {
    expect(filterQuery({ size: "Large", min: 2 })).toBe("size=large&min=2");
    expect(filterQuery({ min: 3 })).toBe("min=3");
    expect(filterQuery(undefined)).toBe("");
    expect(describeFilter({ size: "Large", min: 2 })).toBe("2 or more free Large compartments");
    expect(describeFilter({ size: "Medium", min: 1 })).toBe("a free Medium compartment");
    expect(describeFilter({ min: 3 })).toBe("3 or more free compartments");
  });
});
