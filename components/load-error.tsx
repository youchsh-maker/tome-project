import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";

/** Shown when the Seoul Metro data could not be loaded, so it is never mistaken for an empty result. */
export function LoadError({ retryHref }: { retryHref: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>We couldn&apos;t load locker data right now</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>The Seoul Metro data service did not respond. This does not mean the lockers are full.</p>
        <Link href={retryHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Try again
        </Link>
      </AlertDescription>
    </Alert>
  );
}
