const BASE = "https://apis.data.go.kr/B553766/facility";

export class FacilityApiError extends Error {}

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
