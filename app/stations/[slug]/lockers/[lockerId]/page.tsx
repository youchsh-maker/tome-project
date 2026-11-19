import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadError } from "@/components/load-error";
import { LockerMap } from "@/components/locker-map";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchElevators, type Elevator } from "@/features/elevators";
import { fetchLockers, formatUpdatedAt, hasFree, lockerTitle, todayFor, type Locker } from "@/features/lockers";
import { buildStations, findStation } from "@/features/stations";

export default async function LockerPage({ params }: PageProps<"/stations/[slug]/lockers/[lockerId]">) {
  const { slug, lockerId } = await params;
  const retryHref = `/stations/${slug}/lockers/${lockerId}`;

  let lockers: Locker[];
  try {
    lockers = await fetchLockers();
  } catch {
    return <LoadError retryHref={retryHref} />;
  }
  const station = findStation(buildStations(lockers.map((l) => l.stationKo)), slug);
  const locker = station && lockers.find((l) => l.id === lockerId && l.stationKo === station.nameKo);
  if (!station || !locker) notFound();

  let elevators: Elevator[];
  try {
    elevators = await fetchElevators(station.nameKo);
  } catch {
    return <LoadError retryHref={retryHref} />;
  }

  const today = todayFor(locker, new Date());

  return (
    <>
      <section className="flex flex-col gap-1">
        <Link href={`/stations/${station.slug}`} className="text-sm text-muted-foreground hover:underline">
          ← All lockers at {station.nameEn}
        </Link>
        <h1 className="text-2xl font-semibold">
          {station.nameEn} · {lockerTitle(locker)}
        </h1>
        <p className="text-muted-foreground">
          Free now: Large {locker.available.Large} · Medium {locker.available.Medium} · Small{" "}
          {locker.available.Small} (updated {formatUpdatedAt(locker)}) · Open today {today.hours}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Where the locker is</CardTitle>
          <CardDescription>Location in Korean. You can show this to station staff if you need help.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p lang="ko" className="text-lg font-medium">
            {locker.detailKo}
          </p>
          <LockerMap
            label={`Map of ${lockerTitle(locker)} at ${station.nameEn}`}
            points={[
              {
                id: locker.id,
                lat: locker.lat,
                lon: locker.lon,
                label: `${station.nameEn} · ${lockerTitle(locker)}`,
                free: hasFree(locker),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Pay and unlock with the T-Locker app</AlertTitle>
        <AlertDescription>
          These lockers are paid for and opened with the T-Locker app. Scan the QR code on the locker to start.
        </AlertDescription>
      </Alert>

      <section className="flex flex-col gap-3" aria-label="Elevators in this station">
        <div>
          <h2 className="text-lg font-medium">Elevators in this station</h2>
          <p className="text-sm text-muted-foreground">
            Use these to reach the locker without stairs. The nearest elevator to the locker is not recorded, so all
            are listed.
          </p>
        </div>
        {elevators.length === 0 ? (
          <p className="text-muted-foreground">No elevator information is available for this station.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {elevators.map((e) => (
              <li key={e.id}>
                <Card className={e.status === "in-service" ? undefined : "opacity-70"}>
                  <CardContent className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.exit}</span>
                      <span className="text-muted-foreground">{e.floors}</span>
                      <Badge variant={e.status === "out-of-service" ? "destructive" : e.status === "unknown" ? "outline" : "secondary"}>
                        {e.statusLabel}
                      </Badge>
                    </div>
                    <p lang="ko" className="text-sm text-muted-foreground">
                      {e.detailKo}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
