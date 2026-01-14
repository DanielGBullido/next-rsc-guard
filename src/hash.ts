/**
 * Next.js uses a short non-cryptographic hash for cache-busting.
 * Implementation mirrors: djb2 32-bit -> base36 -> slice(0,5).
 */

export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

export function nextHexHash(str: string): string {
  return djb2Hash(str).toString(36).slice(0, 5);
}
