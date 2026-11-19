import Link from "next/link";

import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchLockers } from "@/features/lockers";
import { buildStations, searchStations, type Station } from "@/features/stations";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  let results: Station[] | null = null;
  let failed = false;
  if (query) {
    try {
      const lockers = await fetchLockers();
      results = searchStations(buildStations(lockers.map((l) => l.stationKo)), query);
    } catch {
      failed = true;
    }
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Find a free locker for your luggage</h1>
        <p className="text-muted-foreground">
          Enter a Seoul subway station to see lockers with free space right now and the elevator route to them.
        </p>
      </section>

      <form action="/" className="flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Station name, e.g. Gangnam"
          aria-label="Station name"
          autoComplete="off"
          required
        />
        <Button type="submit">Search</Button>
      </form>

      {failed && <LoadError retryHref={`/?q=${encodeURIComponent(query)}`} />}

      {results && results.length === 0 && (
        <p className="text-muted-foreground">
          No Seoul Metro station matches &ldquo;{query}&rdquo;. Try part of the English name, like &ldquo;hongik&rdquo;.
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
    </>
  );
}
