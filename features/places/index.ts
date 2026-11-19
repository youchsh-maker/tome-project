export type Area = { name: string; lat: number; lon: number };

export class PlaceSearchError extends Error {}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Seoul bounding box (west, north, east, south).
const SEOUL = "126.76,37.70,127.19,37.42";

/** Finds a Seoul area (e.g. "Hannam-dong") with OpenStreetMap Nominatim. Returns null when nothing matches. */
export async function findArea(query: string): Promise<Area | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "kr");
  url.searchParams.set("viewbox", SEOUL);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("accept-language", "en");

  let items: { lat?: string; lon?: string; name?: string }[];
  try {
    const res = await fetch(url, {
      // Nominatim's usage policy asks for an identifying User-Agent and for results to be cached.
      headers: { "User-Agent": "LockerRadar/0.1 (learning project)" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new PlaceSearchError(`HTTP ${res.status}`);
    items = await res.json();
  } catch (e) {
    throw e instanceof PlaceSearchError ? e : new PlaceSearchError(String(e));
  }

  const first = items[0];
  if (!first?.lat || !first.lon) return null;
  return { name: first.name || query, lat: Number(first.lat), lon: Number(first.lon) };
}
