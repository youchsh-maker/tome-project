import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadError } from "@/components/load-error";
import { LockerMap } from "@/components/locker-map";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchLockers,
  findNearbyFree,
  formatDistance,
  formatUpdatedAt,
  hasFree,
  describeFilter,
  filterFrom,
  filterQuery,
  lockerTitle,
  todayFor,
  type Locker,
} from "@/features/lockers";
import { buildStations, findStation, type Station } from "@/features/stations";

export default async function StationPage({ params, searchParams }: PageProps<"/stations/[slug]">) {
  const { slug } = await params;
  const filter = filterFrom(await searchParams);
  const query = filterQuery(filter);

  let lockers: Locker[];
  try {
    lockers = await fetchLockers();
  } catch {
    return <LoadError retryHref={`/stations/${slug}${query ? `?${query}` : ""}`} />;
  }

  const stations = buildStations(lockers.map((l) => l.stationKo));
  const station = findStation(stations, slug);
  if (!station) notFound();

  const atStation = lockers.filter((l) => l.stationKo === station.nameKo);
  const noneFree = !atStation.some((l) => hasFree(l, filter));
  // With a filter, list only lockers that match it (all of them when none do).
  const here = filter && !noneFree ? atStation.filter((l) => hasFree(l, filter)) : atStation;
  const nearby = noneFree ? findNearbyFree(lockers, station.nameKo, 3, filter) : [];
  const now = new Date();
  const stationOf = (l: Locker) => stations.find((s) => s.nameKo === l.stationKo);

  return (
    <>
      <section className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← New search
        </Link>
        <h1 className="text-2xl font-semibold">{station.nameEn}</h1>
        <p className="text-muted-foreground">
          {atStation.length} locker {atStation.length === 1 ? "bank" : "banks"} in this station
        </p>
        {filter && (
          <p className="text-sm">
            Showing lockers with {describeFilter(filter)} ·{" "}
            <Link href={`/stations/${station.slug}`} className="text-primary underline underline-offset-4">
              Show all lockers
            </Link>
          </p>
        )}
      </section>

      {noneFree && (
        <Alert>
          <AlertTitle>
            {filter
              ? `No lockers with ${describeFilter(filter)} at ${station.nameEn} right now`
              : `No free compartments at ${station.nameEn} right now`}
          </AlertTitle>
          <AlertDescription>
            {nearby.length > 0
              ? `These nearby stations have lockers with ${describeFilter(filter)}, nearest first (straight-line distance).`
              : `No nearby station has a locker with ${describeFilter(filter)} either. Please try again later.`}
          </AlertDescription>
        </Alert>
      )}

      <LockerMap
        label={`Map of lockers at ${station.nameEn}`}
        points={[...here, ...nearby.map((n) => n.locker)].map((l) => {
          const s = l.stationKo === station.nameKo ? station : stationOf(l);
          return {
            id: l.id,
            lat: l.lat,
            lon: l.lon,
            label: s ? `${s.nameEn} · ${lockerTitle(l)}` : lockerTitle(l),
            free: hasFree(l, filter),
            available: l.available,
            href: s ? `/stations/${s.slug}/lockers/${l.id}` : undefined,
          };
        })}
      />

      {noneFree && nearby.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Nearby free lockers">
          <h2 className="text-lg font-medium">Nearby free lockers</h2>
          {nearby.map(({ locker, distanceM }) => (
            <LockerCard
              key={locker.id}
              locker={locker}
              station={stationOf(locker)}
              now={now}
              extra={`${formatDistance(distanceM)} away`}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-label="Lockers at this station">
        {noneFree && <h2 className="text-lg font-medium">Lockers at {station.nameEn}</h2>}
        {here.map((l) => (
          <LockerCard key={l.id} locker={l} station={station} now={now} />
        ))}
      </section>
    </>
  );
}

function LockerCard({
  locker,
  station,
  now,
  extra,
}: {
  locker: Locker;
  station: Station | undefined;
  now: Date;
  extra?: string;
}) {
  const today = todayFor(locker, now);
  const free = hasFree(locker);
  const body = (
    <Card className={station ? "transition-colors hover:bg-muted" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {extra && station ? `${station.nameEn} · ` : null}
          {lockerTitle(locker)}
          <Badge variant={free ? "default" : "secondary"}>{free ? "Free now" : "Full"}</Badge>
        </CardTitle>
        <CardDescription>
          {extra ? `${extra} · ` : null}Updated {formatUpdatedAt(locker)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(["Large", "Medium", "Small"] as const).map((size) => (
            <div key={size} className="rounded-lg bg-muted p-2">
              <dt className="text-muted-foreground">{size}</dt>
              <dd className="text-lg font-semibold">{locker.available[size]} free</dd>
              {locker.dimensions[size] && (
                <dd className="text-xs text-muted-foreground">{locker.dimensions[size]}</dd>
              )}
            </div>
          ))}
        </dl>
        {Object.keys(locker.dimensions).length > 0 && (
          <p className="text-xs text-muted-foreground">Compartment size: width × depth × height</p>
        )}
        <p>
          <span className="text-muted-foreground">Open today: </span>
          {today.hours}
        </p>
        <div>
          <p className="text-muted-foreground">Today&apos;s fee</p>
          {today.fees ? (
            <ul>
              {today.fees.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p lang="ko" className="whitespace-pre-line">
              {locker.feeRaw}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
  return station ? (
    <Link href={`/stations/${station.slug}/lockers/${locker.id}`}>
      {body}
    </Link>
  ) : (
    body
  );
}
