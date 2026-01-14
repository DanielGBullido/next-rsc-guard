export type HeaderBag =
  | Headers
  | Record<string, string | undefined>
  | Array<[string, string]>;

export function getHeader(
  headers: HeaderBag,
  name: string
): string | undefined {
  const key = name.toLowerCase();

  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(key) ?? undefined;
  }

  if (Array.isArray(headers)) {
    const hit = headers.find(([k]) => k.toLowerCase() === key);
    return hit?.[1];
  }

  const obj = headers as Record<string, string | undefined>;
  return obj[name] ?? obj[key];
}
