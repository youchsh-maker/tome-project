import Link from "next/link";

import { LoadError } from "@/components/load-error";
import { LockerMap, type MapPoint } from "@/components/locker-map";
import { SearchFilter } from "@/components/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchLockers,
  findFreeNear,
  formatDistance,
  describeFilter,
  filterFrom,
  filterQuery,
  lockerTitle,
  summarizeByStation,
  type Locker,
} from "@/features/lockers";
import { findArea, type Area } from "@/features/places";
import { buildStations, searchStations, type Station } from "@/features/stations";

type AreaResult = { area: Area; nearby: { locker: Locker; station: Station; distanceM: number }[] };

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const filter = filterFrom(params);
  const keep = filterQuery(filter);

  let results: Station[] | null = null;
  let areaResult: AreaResult | null = null;
  let failed = false;
  if (query) {
    try {
      const lockers = await fetchLockers();
      const stations = buildStations(lockers.map((l) => l.stationKo));
      results = searchStations(stations, query);
      // Not a station name: look the query up as a Seoul area and list the nearest free lockers.
      if (results.length === 0) {
        const area = await findArea(query);
        if (area) {
          const nearby = findFreeNear(lockers, area, 5, filter).flatMap(({ locker, distanceM }) => {
            const station = stations.find((s) => s.nameKo === locker.stationKo);
            return station ? [{ locker, station, distanceM }] : [];
          });
          areaResult = { area, nearby };
        }
      }
    } catch {
      failed = true;
    }
  }

  // Before a search, show every station on one map. The map is a bonus, so a data failure just hides it.
  let overview: MapPoint[] | null = null;
  if (!query) {
    try {
      const lockers = await fetchLockers();
      const stations = buildStations(lockers.map((l) => l.stationKo));
      overview = summarizeByStation(lockers).flatMap((s) => {
        const station = stations.find((st) => st.nameKo === s.stationKo);
        return station
          ? [
              {
                id: station.slug,
                lat: s.lat,
                lon: s.lon,
                label: station.nameEn,
                free: s.total > 0,
                available: s.available,
                href: `/stations/${station.slug}`,
                linkLabel: "See lockers",
              },
            ]
          : [];
      });
    } catch {
      overview = null;
    }
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Find a free locker for your luggage</h1>
        <p className="text-muted-foreground">
          Enter a subway station or an area to see lockers with free space right now and the elevator route to them.
        </p>
      </section>

      <form id="search" action="/" className="flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Station or area, e.g. Gangnam, Hannam-dong"
          aria-label="Station name"
          autoComplete="off"
          required
        />
        <Button type="submit">Search</Button>
      </form>
      <SearchFilter size={filter?.size?.toLowerCase() ?? ""} min={filter?.min ?? 1} />

      {overview && overview.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Lockers across Seoul right now">
          <h2 className="text-lg font-medium">Lockers across Seoul right now</h2>
          <p className="text-sm text-muted-foreground">
            Each dot is a station. Zoom in to see how many compartments are free, and tap one for sizes and its lockers.
          </p>
          <LockerMap label="Map of lockers across Seoul" points={overview} variant="overview" />
        </section>
      )}

      {failed && <LoadError retryHref={`/?q=${encodeURIComponent(query)}${keep ? `&${keep}` : ""}`} />}

      {results && results.length === 0 && !areaResult && !failed && (
        <p className="text-muted-foreground">
          No Seoul Metro station or Seoul area matches &ldquo;{query}&rdquo;. Try part of the English name, like
          &ldquo;hongik&rdquo; or &ldquo;itaewon&rdquo;.
        </p>
      )}

      {results && results.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Matching stations">
          <h2 className="text-sm font-medium text-muted-foreground">Matching stations</h2>
          <ul className="flex flex-col gap-2">
            {results.map((s) => (
              <li key={s.slug}>
                <Link href={`/stations/${s.slug}${keep ? `?${keep}` : ""}`} className="block">
                  <Card className="transition-colors hover:bg-muted">
                    <CardContent className="font-medium">{s.nameEn}</CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {areaResult && (
        <section className="flex flex-col gap-3" aria-label={`Lockers near ${areaResult.area.name}`}>
          <div>
            <h2 className="text-lg font-medium">Free lockers near {areaResult.area.name}</h2>
            <p className="text-sm text-muted-foreground">
              {filter ? `Lockers with ${describeFilter(filter)}, nearest` : "Nearest"} first, straight-line distance
              from the area center.
            </p>
          </div>
          {areaResult.nearby.length === 0 ? (
            <p className="text-muted-foreground">
              No locker with {describeFilter(filter)} was found near this area right now.
            </p>
          ) : (
            <>
              <LockerMap
                label={`Map of free lockers near ${areaResult.area.name}`}
                points={areaResult.nearby.map(({ locker, station }) => ({
                  id: locker.id,
                  lat: locker.lat,
                  lon: locker.lon,
                  label: `${station.nameEn} · ${lockerTitle(locker)}`,
                  free: true,
                  available: locker.available,
                  href: `/stations/${station.slug}/lockers/${locker.id}`,
                }))}
              />
              <ul className="flex flex-col gap-2">
                {areaResult.nearby.map(({ locker, station, distanceM }) => (
                  <li key={locker.id}>
                    <Link href={`/stations/${station.slug}/lockers/${locker.id}`} className="block">
                      <Card className="transition-colors hover:bg-muted">
                        <CardHeader>
                          <CardTitle>
                            {station.nameEn} · {lockerTitle(locker)}
                          </CardTitle>
                          <CardDescription>
                            {formatDistance(distanceM)} away · Free now: Large {locker.available.Large} · Medium{" "}
                            {locker.available.Medium} · Small {locker.available.Small}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
