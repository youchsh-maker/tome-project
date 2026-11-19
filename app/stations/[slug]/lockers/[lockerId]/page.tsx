import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadError } from "@/components/load-error";
import { LockerMap } from "@/components/locker-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchElevators, type Elevator } from "@/features/elevators";
import { fetchLockers, formatUpdatedAt, hasFree, lockerTitle, todayFor, type Locker } from "@/features/lockers";
import { buildStations, findStation } from "@/features/stations";

const T_LOCKER_GUIDE = "https://english1.visitkorea.or.kr/enu/FU/KTO_EN_15.jsp?cid=2656890";
const T_LOCKER_SITE = "https://tlocker.co.kr/";

// English version of the operator's usage text (useMthdExpln), identical for every locker on 2026-11-19.
const T_LOCKER_STEPS = [
  {
    title: "To store your luggage",
    steps: [
      "Install the T-Locker app",
      "Scan the QR code on the locker",
      "Choose the compartment to use",
      "Pay the base fee",
      "Check your password in the app and enter it on the lock",
      "Put your luggage in",
    ],
  },
  {
    title: "To pick it up",
    steps: [
      "Open the T-Locker app",
      "Select your locker in use",
      "Pay the extra fee, if any",
      "Check your password in the app and enter it on the lock",
      "Take your luggage",
    ],
  },
];

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
  const platformElevators = elevators.filter((e) => e.kind === "platform");
  const exitElevators = elevators.filter((e) => e.kind === "exit");

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

      <section className="flex flex-col gap-3" aria-label="Your route from the train">
        <h2 className="text-lg font-medium">Your route from the train</h2>
        <ol className="flex flex-col gap-3">
          <Step n={1} title="Get off the train and take an elevator up to the concourse">
            <p className="text-sm text-muted-foreground">
              Board near one of these train doors so you step out next to an elevator.
            </p>
            {platformElevators.length === 0 ? (
              <p className="text-muted-foreground">No platform elevator is listed for this station.</p>
            ) : (
              <ElevatorList elevators={platformElevators} />
            )}
          </Step>

          <Step n={2} title="Walk to the locker">
            {locker.detailEn && <p className="text-lg font-medium">{locker.detailEn}</p>}
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">In Korean, to show station staff if you need help:</p>
              <p lang="ko" className={locker.detailEn ? "text-sm" : "text-lg font-medium"}>
                {locker.detailKo}
              </p>
            </div>
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
          </Step>

          <Step n={3} title="Pay and unlock with the T-Locker app">
            <p className="text-sm">
              These lockers are paid for and opened with the T-Locker app. Install it before you arrive.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {T_LOCKER_STEPS.map(({ title, steps }) => (
                <div key={title} className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                  <h3 className="font-medium">{title}</h3>
                  <ol className="list-decimal pl-5 text-sm">
                    {steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">More help:</p>
            <ul className="flex flex-col gap-1 text-sm">
              <li>
                <a href={T_LOCKER_GUIDE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                  How to use T-Locker (VisitKorea, English)
                </a>
              </li>
              <li>
                <a href={T_LOCKER_SITE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                  T-Locker official site and app download (Korean)
                </a>
              </li>
            </ul>
          </Step>
        </ol>
      </section>

      <section className="flex flex-col gap-3" aria-label="Coming from the street">
        <div>
          <h2 className="text-lg font-medium">Coming from the street?</h2>
          <p className="text-sm text-muted-foreground">These elevators connect the station exits to the concourse.</p>
        </div>
        {exitElevators.length === 0 ? (
          <p className="text-muted-foreground">No street elevator is listed for this station.</p>
        ) : (
          <ElevatorList elevators={exitElevators} />
        )}
      </section>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li>
      <Card>
        <CardHeader>
          <CardDescription>Step {n}</CardDescription>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    </li>
  );
}

function ElevatorList({ elevators }: { elevators: Elevator[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {elevators.map((e) => (
        <li
          key={e.id}
          className={`flex flex-col gap-1 rounded-lg bg-muted p-3 ${e.status === "in-service" ? "" : "opacity-70"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{e.kind === "exit" ? e.exit : (e.detailEn ?? "Elevator")}</span>
            <span className="text-muted-foreground">{e.floors}</span>
            <Badge
              variant={e.status === "out-of-service" ? "destructive" : e.status === "unknown" ? "outline" : "secondary"}
            >
              {e.statusLabel}
            </Badge>
          </div>
          {e.kind === "exit" && e.detailEn && e.detailEn !== e.exit && <p className="text-sm">{e.detailEn}</p>}
          <p lang="ko" className="text-xs text-muted-foreground">
            {e.detailKo}
          </p>
        </li>
      ))}
    </ul>
  );
}
