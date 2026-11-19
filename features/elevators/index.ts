import { fetchFacilityItems } from "@/lib/data-go-kr";

import locationEn from "./location-en.json";

export type RawElevator = Record<string, unknown>;

export type Elevator = {
  id: string;
  /** "platform": connects the platform to the concourse. "exit": connects street level to the station. */
  kind: "platform" | "exit";
  exit: string;
  floors: string;
  status: "in-service" | "out-of-service" | "unknown";
  statusLabel: string;
  /** English location from the pre-translated table; null when the sentence is not in the table. */
  detailEn: string | null;
  detailKo: string;
};

const EN = locationEn as Record<string, string>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());

function exitNumbers(value: string): string[] | null {
  return value.match(/^[\d\s,]+$/) || /번\s*출/.test(value) ? value.match(/\d+/g) : null;
}

function exitLabel(numbers: string[] | null): string {
  if (!numbers) return "Inside the station";
  return `${numbers.length > 1 ? "Exits" : "Exit"} ${numbers.join(", ")}`;
}

type Floor = { label: string; distance: number };

/** Floor label and how far it is from street level (Ground = 0). */
function floor(groundOrUnder: string, value: string): Floor {
  const n = Number(value.replace(/\D/g, "")) || 0;
  if (groundOrUnder === "지상") return { label: value === "1" ? "Ground" : `${value}F`, distance: Math.max(n - 1, 0) };
  return { label: value, distance: n };
}

const STATUS = {
  M: ["in-service", "In service"],
  S: ["out-of-service", "Out of service"],
} as const;

/** Elevators of exactly this station (the API matches station names partially). */
export function normalizeElevators(raw: RawElevator[], stationKo: string): Elevator[] {
  return raw
    .filter((r) => str(r.stnNm) === stationKo)
    .map((r) => {
      const numbers = exitNumbers(str(r.vcntEntrcNo));
      const kind = numbers ? "exit" : "platform";
      const a = floor(str(r.bgngFlrGrndUdgdSe), str(r.bgngFlr));
      const b = floor(str(r.endFlrGrndUdgdSe), str(r.endFlr));
      // Exit elevators read from the street; platform elevators read from where you leave the train.
      const [from, to] = (kind === "exit") === a.distance <= b.distance ? [a, b] : [b, a];
      const [status, statusLabel] = STATUS[str(r.oprtngSitu) as keyof typeof STATUS] ?? ["unknown", "Status unknown"];
      return {
        id: str(r.fcltNo),
        kind,
        exit: exitLabel(numbers),
        floors: `${from.label} → ${to.label}`,
        status,
        statusLabel,
        detailEn: EN[str(r.dtlPstn)] ?? null,
        detailKo: str(r.dtlPstn),
      };
    });
}

export async function fetchElevators(stationKo: string): Promise<Elevator[]> {
  return normalizeElevators(await fetchFacilityItems("/getFcElvtr", { stnNm: stationKo }), stationKo);
}
