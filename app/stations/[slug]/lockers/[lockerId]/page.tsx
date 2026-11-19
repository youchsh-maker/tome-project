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
  // The data has no locker-to-elevator distance, so match on what the location sentences share:
  // the locker's floor for platform elevators and its exit numbers for street elevators.
  const noteFor = (e: Elevator) =>
    e.kind === "platform"
      ? locker.floor && e.arrivesAt === locker.floor
        ? `Arrives on the locker's level (${locker.floor})`
        : null
      : e.exits.some((x) => locker.exits.includes(x))
        ? "Same exit as the locker"
        : null;
  const nearFirst = (list: Elevator[]) =>
    [...list].sort((a, b) => Number(noteFor(b) !== null) - Number(noteFor(a) !== null));
  const platformElevators = nearFirst(elevators.filter((e) => e.kind === "platform"));
  const exitElevators = nearFirst(elevators.filter((e) => e.kind === "exit"));
  const hints = [
    locker.floor && `The locker is on the ${locker.floor} level.`,
    locker.exits.length > 0 && `On the concourse, follow the signs for ${exitsText(locker.exits)}.`,
    locker.gates === "inside" && "It is inside the ticket gates, so you do not need to tap out.",
    locker.gates === "outside" && "It is outside the ticket gates: tap your card at the gate first.",
  ].filter((h): h is string => Boolean(h));

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
            {platformElevators.length === 0 ? (
              <p className="text-muted-foreground">No platform elevator is listed for this station.</p>
            ) : (
              <ElevatorList elevators={platformElevators} noteFor={noteFor} />
            )}
          </Step>

          <Step n={2} title="Walk to the locker">
            {locker.detailEn && <p className="text-lg font-medium">{locker.detailEn}</p>}
            {hints.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Coming down from the street instead?</h3>
              {exitElevators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No street elevator is listed for this station.</p>
              ) : (
                <ElevatorList elevators={exitElevators} noteFor={noteFor} />
              )}
            </div>
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

/** Splits a translated location with several platform positions ("…; …") into one line each. */
function lines(text: string): string[] {
  return text.split(/;\s*/).map((l) => l.charAt(0).toUpperCase() + l.slice(1));
}

function exitsText(exits: string[]): string {
  if (exits.length === 1) return `Exit ${exits[0]}`;
  return `Exits ${exits.slice(0, -1).join(", ")} and ${exits.at(-1)}`;
}

function ElevatorList({ elevators, noteFor }: { elevators: Elevator[]; noteFor: (e: Elevator) => string | null }) {
  return (
    <ul className="flex flex-col gap-2">
      {elevators.map((e) => (
        <li
          key={e.id}
          className={`flex flex-col gap-1 rounded-lg p-3 ${
            noteFor(e) ? "bg-primary/10 ring-2 ring-primary/40" : "bg-primary/5 ring-1 ring-primary/15"
          } ${e.status === "in-service" ? "" : "opacity-70"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {e.kind === "exit" ? (
              <span className="font-medium">{e.exit}</span>
            ) : (
              <span className="flex flex-col font-medium">
                {lines(e.detailEn ?? "Elevator").map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </span>
            )}
            <span className="text-muted-foreground">{e.floors}</span>
            <Badge
              variant={e.status === "out-of-service" ? "destructive" : e.status === "unknown" ? "outline" : "secondary"}
            >
              {e.statusLabel}
            </Badge>
            {noteFor(e) && <Badge>{noteFor(e)}</Badge>}
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
