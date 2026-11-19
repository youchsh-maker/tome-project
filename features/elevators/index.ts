import { fetchFacilityItems } from "@/lib/data-go-kr";

export type RawElevator = Record<string, unknown>;

export type Elevator = {
  id: string;
  exit: string;
  floors: string;
  status: "in-service" | "out-of-service" | "unknown";
  statusLabel: string;
  detailKo: string;
};

const str = (v: unknown) => (v == null ? "" : String(v).trim());

function exitLabel(value: string): string {
  const numbers = value.match(/^[\d\s,]+$/) || /번\s*출/.test(value) ? value.match(/\d+/g) : null;
  if (!numbers) return "Inside the station";
  return `${numbers.length > 1 ? "Exits" : "Exit"} ${numbers.join(", ")}`;
}

function floorLabel(groundOrUnder: string, floor: string): string {
  if (groundOrUnder === "지상") return floor === "1" ? "Ground" : `${floor}F`;
  return floor;
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
      const [status, statusLabel] = STATUS[str(r.oprtngSitu) as keyof typeof STATUS] ?? ["unknown", "Status unknown"];
      return {
        id: str(r.fcltNo),
        exit: exitLabel(str(r.vcntEntrcNo)),
        floors: `${floorLabel(str(r.bgngFlrGrndUdgdSe), str(r.bgngFlr))} → ${floorLabel(str(r.endFlrGrndUdgdSe), str(r.endFlr))}`,
        status,
        statusLabel,
        detailKo: str(r.dtlPstn),
      };
    });
}

export async function fetchElevators(stationKo: string): Promise<Elevator[]> {
  return normalizeElevators(await fetchFacilityItems("/getFcElvtr", { stnNm: stationKo }), stationKo);
}
