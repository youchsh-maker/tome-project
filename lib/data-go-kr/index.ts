const BASE = "https://apis.data.go.kr/B553766/facility";

/** Every failure is logged here so the cause shows in the server logs even though pages only show a generic error. */
export class FacilityApiError extends Error {
  constructor(message: string) {
    super(message);
    console.error(`[data-go-kr] ${message}`);
  }
}

/** Calls a Seoul Metro facility endpoint on the server and returns its items. */
export async function fetchFacilityItems(
  path: "/getFcLckr" | "/getFcElvtr",
  params: Record<string, string> = {},
): Promise<Record<string, unknown>[]> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new FacilityApiError("DATA_GO_KR_KEY is not set");

  const url = new URL(BASE + path);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "2000");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let body: { response?: { header?: { resultCode?: string }; body?: { items?: { item?: unknown } } } };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new FacilityApiError(`HTTP ${res.status}`);
    body = await res.json();
  } catch (e) {
    throw e instanceof FacilityApiError ? e : new FacilityApiError(String(e));
  }
  const code = body.response?.header?.resultCode;
  if (code !== "00") throw new FacilityApiError(`resultCode ${code}`);
  const item = body.response?.body?.items?.item;
  return item == null ? [] : ([] as Record<string, unknown>[]).concat(item as Record<string, unknown>);
}

const MOIS_BASE = "https://apis.data.go.kr/B551982/psl_v2";

/**
 * Calls the MOIS nationwide public locker API (data.go.kr 15142469) on the server.
 * Location and detail data change rarely, so they are cached for a day; real-time counts are not cached.
 */
export async function fetchMoisItems(
  path: "/locker_info_v2" | "/locker_detail_info_v2" | "/locker_realtime_use_v2",
): Promise<Record<string, unknown>[]> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new FacilityApiError("DATA_GO_KR_KEY is not set");

  const url = new URL(MOIS_BASE + path);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("type", "JSON");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");

  let body: { header?: { resultCode?: string }; body?: { item?: unknown } };
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      ...(path === "/locker_realtime_use_v2" ? { cache: "no-store" } : { next: { revalidate: 86400 } }),
    });
    if (!res.ok) throw new FacilityApiError(`HTTP ${res.status}`);
    body = await res.json();
  } catch (e) {
    throw e instanceof FacilityApiError ? e : new FacilityApiError(String(e));
  }
  const code = body.header?.resultCode;
  if (code !== "K0") throw new FacilityApiError(`resultCode ${code}`);
  const item = body.body?.item;
  return item == null ? [] : ([] as Record<string, unknown>[]).concat(item as Record<string, unknown>);
}
