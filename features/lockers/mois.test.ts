import { describe, expect, it } from "vitest";

import { normalizeMoisLockers } from "@/features/lockers";

// Shapes taken from the 2026-11-19 response of the MOIS nationwide public locker API (data.go.kr 15142469).
const info = [
  {
    stlckId: "TL821",
    stlckRprsPstnNm: "8호선 산성",
    stlckDtlPstnNm: "산성역 B1층 대합실앞 내 (현금인출기 주변)",
    lat: "37.4568550000",
    lot: "127.1499390000",
    wkdyOperBgngTm: "050000",
    wkdyOperEndTm: "010000",
    satOperBgngTm: "050000",
    satOperEndTm: "010000",
    lhldyOperBgngTm: "050000",
    lhldyOperEndTm: "000000",
  },
  { stlckId: "TL222A", stlckRprsPstnNm: "2호선 강남(1~52)", stlckDtlPstnNm: "1번 출입구 통로", lat: "37.49", lot: "127.02" },
  { stlckId: "4", stlckRprsPstnNm: "경전철 의정부역", stlckDtlPstnNm: "2층 대합실", lat: "37.73", lot: "127.04" },
  { stlckId: "A042A", stlckRprsPstnNm: "서울식물원 서울식물원(1~12)", stlckDtlPstnNm: "방문자센터 내부", lat: "37.56", lot: "126.82" },
];
const realtime = [
  { stlckId: "TL821", usePsbltyLrgszStlckCnt: "1", usePsbltyMdmszStlckCnt: "2", usePsbltySmlszStlckCnt: "6", totDt: "20261119143000" },
];
const detail = [
  {
    stlckId: "TL821",
    stlckWdthLenExpln: "・ 소형 : 50(cm)\r\n・ 중형 : 50(cm)\r\n・ 대형 : 50(cm)",
    stlckDpthExpln: "・ 소형 : 60(cm)\r\n・ 중형 : 60(cm)\r\n・ 대형 : 60(cm)",
    stlckHgtExpln: "・ 소형 : 30(cm)\r\n・ 중형 : 45(cm)\r\n・ 대형 : 90(cm)",
    utztnCrgExpln:
      "・ 4시간 기본요금 부과 이후 1시간당 추가요금발생\r\n・ 주중 요금(월-금) : \r\n소형: 기본요금 2,200원, 추가요금 500원\r\n중형: 기본요금 3,300원, 추가요금 800원\r\n대형: 기본요금 4,400원, 추가요금 1,000원\r\n・ 주말 요금(토, 일) :\r\n소형: 기본요금 3,100원, 추가요금 500원\r\n중형: 기본요금 4,600원, 추가요금 800원\r\n대형: 기본요금 6,100원, 추가요금 1,000원",
    useMthdExpln: "또타라커 (T-Locker) 이용 방법",
  },
];

describe("MOIS nationwide locker data", () => {
  const lockers = normalizeMoisLockers({ info, realtime, detail }, new Set(["TL222A"]));

  it("adds subway lockers the Seoul Metro data does not have, as the same locker shape", () => {
    expect(lockers.map((l) => l.id)).toEqual(["TL821"]);
    expect(lockers[0]).toMatchObject({
      stationKo: "산성",
      line: "8호선",
      detailKo: "산성역 B1층 대합실앞 내 (현금인출기 주변)",
      available: { Large: 1, Medium: 2, Small: 6 },
      lat: 37.456855,
      lon: 127.149939,
      updatedAt: "2026-11-19T14:30:00",
      floor: "B1",
      usesTLocker: true,
      dimensions: { Large: "50 × 60 × 90 cm", Medium: "50 × 60 × 45 cm", Small: "50 × 60 × 30 cm" },
    });
    expect(lockers[0].fees?.weekday.Large).toEqual({ base: 4400, extra: 1000 });
  });

  it("skips lockers already in the Seoul Metro data, light rail, and non-station places", () => {
    expect(lockers.some((l) => ["TL222A", "4", "A042A"].includes(l.id))).toBe(false);
  });

  it("skips a locker without real-time counts rather than showing it as full", () => {
    const noRealtime = normalizeMoisLockers({ info, realtime: [], detail }, new Set());
    expect(noRealtime).toEqual([]);
  });
});
