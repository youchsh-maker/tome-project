import Link from "next/link";

import { LoadError } from "@/components/load-error";
import { LockerMap } from "@/components/locker-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchLockers, findFreeNear, formatDistance, lockerTitle, type Locker } from "@/features/lockers";
import { findArea, type Area } from "@/features/places";
import { buildStations, searchStations, type Station } from "@/features/stations";

type AreaResult = { area: Area; nearby: { locker: Locker; station: Station; distanceM: number }[] };

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

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
          const nearby = findFreeNear(lockers, area).flatMap(({ locker, distanceM }) => {
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

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Find a free locker for your luggage</h1>
        <p className="text-muted-foreground">
          Enter a Seoul subway station or an area to see lockers with free space right now and the elevator route to
          them.
        </p>
      </section>

      <form action="/" className="flex gap-2" role="search">
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

      {failed && <LoadError retryHref={`/?q=${encodeURIComponent(query)}`} />}

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
                <Link href={`/stations/${s.slug}`} className="block">
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
            <p className="text-sm text-muted-foreground">Nearest first, straight-line distance from the area center.</p>
          </div>
          {areaResult.nearby.length === 0 ? (
            <p className="text-muted-foreground">No free locker was found near this area right now.</p>
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
