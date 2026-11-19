import names from "./station-names.json";

export type Station = { slug: string; nameKo: string; nameEn: string };

const englishByKo = new Map<string, string>();
for (const row of names) if (!englishByKo.has(row.ko)) englishByKo.set(row.ko, row.en);

function slugify(en: string) {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Groups station names from the locker data into stations that have an official English name. */
export function buildStations(koreanNames: string[]): Station[] {
  const stations: Station[] = [];
  for (const nameKo of new Set(koreanNames)) {
    const nameEn = englishByKo.get(nameKo);
    if (nameEn) stations.push({ slug: slugify(nameEn), nameKo, nameEn });
  }
  return stations;
}

export function searchStations(stations: Station[], query: string): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (s: Station) => (s.nameEn.toLowerCase().startsWith(q) || s.nameKo.startsWith(q) ? 0 : 1);
  return stations
    .filter((s) => s.nameEn.toLowerCase().includes(q) || s.nameKo.includes(q))
    .sort((a, b) => rank(a) - rank(b) || a.nameEn.length - b.nameEn.length);
}

export function findStation(stations: Station[], slug: string): Station | undefined {
  return stations.find((s) => s.slug === slug);
}
