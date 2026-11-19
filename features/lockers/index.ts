import { fetchFacilityItems, fetchMoisItems } from "@/lib/data-go-kr";

import locationEn from "./location-en.json";

const EN = locationEn as Record<string, string>;

export type RawLocker = Record<string, unknown>;
export type Size = "Large" | "Medium" | "Small";

type SizeFee = { base: number; extra: number };
type Fees = { baseHours: number; weekday: Record<Size, SizeFee>; weekend: Record<Size, SizeFee> };

export type Locker = {
  id: string;
  stationKo: string;
  line: string;
  name: string;
  /** English location from the pre-translated table; null when the sentence is not in the table. */
  detailEn: string | null;
  detailKo: string;
  available: Record<Size, number>;
  lat: number;
  lon: number;
  updatedAt: string;
  feeRaw: string;
  fees: Fees | null;
  hours: { weekday: [string, string]; saturday: [string, string]; holiday: [string, string] };
  dimensions: Partial<Record<Size, string>>;
  exits: string[];
  floor: string | null;
  gates: "inside" | "outside" | null;
  usesTLocker: boolean;
};

const SIZES: Size[] = ["Large", "Medium", "Small"];
const SIZE_KO: Record<Size, string> = { Large: "대형", Medium: "중형", Small: "소형" };

const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => Number(v) || 0;
const won = (s: string) => Number(s.replace(/,/g, ""));

function parseFees(text: string): Fees | null {
  const t = text.replace(/\s+/g, "");
  const baseHours = t.match(/(\d+)시간기본요금/);
  const weekdayAt = t.indexOf("주중요금");
  const weekendAt = t.indexOf("주말요금");
  if (!baseHours || weekdayAt < 0 || weekendAt < 0) return null;
  const block = (part: string) => {
    const out = {} as Record<Size, SizeFee>;
    for (const size of SIZES) {
      const m = part.match(new RegExp(`${SIZE_KO[size]}:기본요금([\\d,]+)원,추가요금([\\d,]+)원`));
      if (!m) return null;
      out[size] = { base: won(m[1]), extra: won(m[2]) };
    }
    return out;
  };
  const weekday = block(t.slice(weekdayAt, weekendAt > weekdayAt ? weekendAt : undefined));
  const weekend = block(t.slice(weekendAt, weekdayAt > weekendAt ? weekdayAt : undefined));
  if (!weekday || !weekend) return null;
  return { baseHours: Number(baseHours[1]), weekday, weekend };
}

function cmFor(text: string, size: Size): string | undefined {
  return text.replace(/\s+/g, "").match(new RegExp(`${SIZE_KO[size]}:(\\d+)\\(cm\\)`))?.[1];
}

/** Width × depth × height in cm per size, from the Korean size sentences. Unreadable sizes are left out. */
function parseDimensions(r: RawLocker): Partial<Record<Size, string>> {
  const out: Partial<Record<Size, string>> = {};
  for (const size of SIZES) {
    const cm = [r.lckrWdthLenExpln, r.lckrDpthExpln, r.lckrHgtExpln].map((v) => cmFor(str(v), size));
    if (cm.every(Boolean)) out[size] = `${cm.join(" × ")} cm`;
  }
  return out;
}

/** Exit numbers named in the Korean location, e.g. "4.6번 출구" → ["4", "6"], "3~5번" → ["3", "4", "5"]. */
function exitsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d+(?:\s*[,.~]\s*\d+)*)\s*번\s*(?:출입구|출구)/g)) {
    for (const part of m[1].split(/\s*[,.]\s*/)) {
      const [from, to] = part.split(/\s*~\s*/).map(Number);
      if (to) for (let i = from; i <= to; i++) out.push(String(i));
      else out.push(String(from));
    }
  }
  return [...new Set(out)];
}

/** Underground level named in the Korean location ("지하2층" or "B2층"), e.g. "B2". */
function floorIn(text: string): string | null {
  const m = text.match(/지하\s*(\d)\s*층|B(\d)\s*층?/);
  return m ? `B${m[1] ?? m[2]}` : null;
}

function gatesIn(text: string): "inside" | "outside" | null {
  if (/게이트\s*(내부|안)/.test(text)) return "inside";
  if (/게이트\s*(외부|밖)/.test(text)) return "outside";
  return null;
}

/** Normalizes Seoul Metro locker items. Line 9 is outside the service scope. */
export function normalizeLockers(raw: RawLocker[]): Locker[] {
  return raw
    .filter((r) => str(r.lineNm) !== "9호선")
    .map((r) => ({
      id: str(r.lckrId),
      stationKo: str(r.stnNm),
      line: str(r.lineNm),
      name: str(r.lckrRprsLocNm),
      detailEn: EN[str(r.lckrDtlLocNm).trim()] ?? null,
      detailKo: str(r.lckrDtlLocNm),
      available: {
        Large: num(r.usePsbltyLrtypeLckrCnt),
        Medium: num(r.usePsbltyMdtypeLckrCnt),
        Small: num(r.usePsbltySmttypeLckrCnt),
      },
      lat: num(r.LAT),
      lon: num(r.LOT),
      updatedAt: str(r.totCrtrDt),
      feeRaw: str(r.utztnCrgExpln),
      fees: parseFees(str(r.utztnCrgExpln)),
      dimensions: parseDimensions(r),
      exits: exitsIn(str(r.lckrDtlLocNm)),
      floor: floorIn(str(r.lckrDtlLocNm)),
      gates: gatesIn(str(r.lckrDtlLocNm)),
      usesTLocker: /또타라커|T-?Locker/i.test(str(r.useMthdExpln)),
      hours: {
        weekday: [str(r.wkdayOperBgngTm), str(r.wkdayOperEndTm)],
        saturday: [str(r.satOperBgngTm), str(r.satOperEndTm)],
        holiday: [str(r.lhldyOperBgngTm), str(r.lhldyOperEndTm)],
      },
    }));
}

/** Whether the locker has a free compartment, of the given size when one is given. */
export function hasFree(l: Locker, size?: Size): boolean {
  if (size) return l.available[size] > 0;
  return l.available.Large + l.available.Medium + l.available.Small > 0;
}

function seoulWeekday(now: Date): number {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
}

const hhmm = (t: string) => (t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : "?");
const krw = (n: number) => `₩${n.toLocaleString("en-US")}`;

/** Today's (KST) operating hours and fee lines; fees is null when the fee text could not be parsed. */
export function todayFor(l: Locker, now: Date): { hours: string; fees: string[] | null } {
  const day = seoulWeekday(now);
  const [start, end] = day === 0 ? l.hours.holiday : day === 6 ? l.hours.saturday : l.hours.weekday;
  const fees = l.fees;
  const table = fees && (day === 0 || day === 6 ? fees.weekend : fees.weekday);
  return {
    hours: `${hhmm(start)}–${hhmm(end)}`,
    fees:
      fees && table
        ? SIZES.map((s) => `${s} ${krw(table[s].base)} / ${fees.baseHours}h, +${krw(table[s].extra)}/h`)
        : null,
  };
}

export function formatUpdatedAt(l: Locker): string {
  const m = l.updatedAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} KST` : "unknown";
}

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Free lockers nearest to a point (e.g. an area center), straight-line distance. */
export function findFreeNear(lockers: Locker[], point: { lat: number; lon: number }, limit = 5, size?: Size) {
  return lockers
    .filter((l) => hasFree(l, size))
    .map((locker) => ({ locker, distanceM: distanceM(point, locker) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** Free lockers at other stations, nearest to the given station first (straight-line distance). */
export function findNearbyFree(lockers: Locker[], stationKo: string, limit = 3, size?: Size) {
  const origin = lockers.find((l) => l.stationKo === stationKo);
  if (!origin) return [];
  return findFreeNear(
    lockers.filter((l) => l.stationKo !== stationKo),
    origin,
    limit,
    size,
  );
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** English heading for a locker from its line and compartment range, e.g. "Line 2 · Lockers 1–52". */
export function lockerTitle(l: Locker): string {
  const line = l.line.match(/(\d+)호선/);
  const range = l.name.match(/\((\d+)~(\d+)\)/);
  return [line ? `Line ${line[1]}` : null, range ? `Lockers ${range[1]}–${range[2]}` : "Lockers"]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Seoul Metro lockers, plus the few Seoul Metro-run stations only the MOIS nationwide data has.
 * The MOIS source is supplementary: if it fails, the Seoul Metro lockers are still returned.
 */
export async function fetchLockers(): Promise<Locker[]> {
  const [seoulMetro, mois] = await Promise.all([
    fetchFacilityItems("/getFcLckr"),
    Promise.all([
      fetchMoisItems("/locker_info_v2"),
      fetchMoisItems("/locker_realtime_use_v2"),
      fetchMoisItems("/locker_detail_info_v2"),
    ]).catch(() => null),
  ]);
  const lockers = normalizeLockers(seoulMetro);
  if (!mois) return lockers;
  const [info, realtime, detail] = mois;
  return [...lockers, ...normalizeMoisLockers({ info, realtime, detail }, new Set(seoulMetro.map((r) => str(r.lckrId))))];
}

/** Reads the `size` search param; only "large" is offered as a filter. */
export function sizeFilterFrom(value: unknown): Size | undefined {
  return value === "large" ? "Large" : undefined;
}

type MoisRow = Record<string, unknown>;

/**
 * Subway lockers from the MOIS nationwide API (data.go.kr 15142469) that the Seoul Metro data lacks,
 * such as Seoul Metro stations in Gyeonggi. Only "N호선 역명" lockers with real-time counts are kept.
 */
export function normalizeMoisLockers(
  data: { info: MoisRow[]; realtime: MoisRow[]; detail: MoisRow[] },
  knownIds: Set<string>,
): Locker[] {
  const byId = (rows: MoisRow[]) => new Map(rows.map((r) => [str(r.stlckId), r]));
  const realtime = byId(data.realtime);
  const detail = byId(data.detail);
  const raw: RawLocker[] = [];
  for (const r of data.info) {
    const id = str(r.stlckId);
    const station = str(r.stlckRprsPstnNm).match(/^(\d호선) ([^(]+)/);
    const rt = realtime.get(id);
    if (!station || !rt || knownIds.has(id)) continue;
    const d = detail.get(id) ?? {};
    const t = str(rt.totDt);
    raw.push({
      lckrId: id,
      lineNm: station[1],
      stnNm: station[2].trim(),
      lckrRprsLocNm: r.stlckRprsPstnNm,
      lckrDtlLocNm: r.stlckDtlPstnNm,
      LAT: r.lat,
      LOT: r.lot,
      wkdayOperBgngTm: r.wkdyOperBgngTm,
      wkdayOperEndTm: r.wkdyOperEndTm,
      satOperBgngTm: r.satOperBgngTm,
      satOperEndTm: r.satOperEndTm,
      lhldyOperBgngTm: r.lhldyOperBgngTm,
      lhldyOperEndTm: r.lhldyOperEndTm,
      usePsbltyLrtypeLckrCnt: rt.usePsbltyLrgszStlckCnt,
      usePsbltyMdtypeLckrCnt: rt.usePsbltyMdmszStlckCnt,
      usePsbltySmttypeLckrCnt: rt.usePsbltySmlszStlckCnt,
      totCrtrDt: t.length >= 14 ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}` : "",
      utztnCrgExpln: d.utztnCrgExpln,
      lckrWdthLenExpln: d.stlckWdthLenExpln,
      lckrDpthExpln: d.stlckDpthExpln,
      lckrHgtExpln: d.stlckHgtExpln,
      useMthdExpln: d.useMthdExpln,
    });
  }
  return normalizeLockers(raw);
}
