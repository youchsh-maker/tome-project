import { fetchFacilityItems } from "@/lib/data-go-kr";

export type RawLocker = Record<string, unknown>;
export type Size = "Large" | "Medium" | "Small";

type SizeFee = { base: number; extra: number };
type Fees = { baseHours: number; weekday: Record<Size, SizeFee>; weekend: Record<Size, SizeFee> };

export type Locker = {
  id: string;
  stationKo: string;
  line: string;
  name: string;
  detailKo: string;
  available: Record<Size, number>;
  lat: number;
  lon: number;
  updatedAt: string;
  feeRaw: string;
  fees: Fees | null;
  hours: { weekday: [string, string]; saturday: [string, string]; holiday: [string, string] };
  dimensions: Partial<Record<Size, string>>;
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

/** Normalizes Seoul Metro locker items. Line 9 is outside the service scope. */
export function normalizeLockers(raw: RawLocker[]): Locker[] {
  return raw
    .filter((r) => str(r.lineNm) !== "9호선")
    .map((r) => ({
      id: str(r.lckrId),
      stationKo: str(r.stnNm),
      line: str(r.lineNm),
      name: str(r.lckrRprsLocNm),
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
      hours: {
        weekday: [str(r.wkdayOperBgngTm), str(r.wkdayOperEndTm)],
        saturday: [str(r.satOperBgngTm), str(r.satOperEndTm)],
        holiday: [str(r.lhldyOperBgngTm), str(r.lhldyOperEndTm)],
      },
    }));
}

export function hasFree(l: Locker): boolean {
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

/** Free lockers at other stations, nearest to the given station first (straight-line distance). */
export function findNearbyFree(lockers: Locker[], stationKo: string, limit = 3) {
  const origin = lockers.find((l) => l.stationKo === stationKo);
  if (!origin) return [];
  return lockers
    .filter((l) => l.stationKo !== stationKo && hasFree(l))
    .map((locker) => ({ locker, distanceM: distanceM(origin, locker) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
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

export async function fetchLockers(): Promise<Locker[]> {
  return normalizeLockers(await fetchFacilityItems("/getFcLckr"));
}
