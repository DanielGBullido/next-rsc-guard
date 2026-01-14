import type { HeaderBag } from "./headers";
import { getHeader } from "./headers";
import { nextHexHash } from "./hash";

export type RscGuardAction = "pass" | "strip" | "block";

export interface RscGuardOptions {
  rscQueryParam?: string; // default "_rsc"
  rscHeader?: string; // default "rsc"
  routerStateTreeHeader?: string; // default "next-router-state-tree"
  routerPrefetchHeader?: string; // default "next-router-prefetch"
  segmentPrefetchHeader?: string; // default "next-router-segment-prefetch"
  nextUrlHeader?: string; // default "next-url"

  /**
   * If true, require Accept includes "text/x-component".
   * Default false to avoid regressions across versions/runtimes.
   */
  requireAcceptRsc?: boolean;

  /**
   * Action if _rsc is present but request is not Flight.
   * Default: "strip" (safe for cache, low false positives).
   */
  onNonFlightWithRsc?: RscGuardAction;

  /**
   * Action if request is Flight but _rsc mismatches expected.
   * Default: "strip".
   */
  onMismatch?: RscGuardAction;
}

export interface RscValidationResult {
  hasRscParam: boolean;
  isFlight: boolean;
  expectedRsc?: string;
  providedRsc?: string;
  ok: boolean;
  action: RscGuardAction;
  reason?: string;
  strippedUrl?: string;
}

function normalizeOptions(opts?: RscGuardOptions) {
  return {
    rscQueryParam: "_rsc",
    rscHeader: "rsc",
    routerStateTreeHeader: "next-router-state-tree",
    routerPrefetchHeader: "next-router-prefetch",
    segmentPrefetchHeader: "next-router-segment-prefetch",
    nextUrlHeader: "next-url",
    requireAcceptRsc: false,
    onNonFlightWithRsc: "strip" as const,
    onMismatch: "strip" as const,
    ...opts,
  };
}

/**
 * Minimal heuristic:
 * - rsc: "1"
 * - next-router-state-tree present
 */
export function isFlightRequest(headers: HeaderBag): boolean {
  const rsc = getHeader(headers, "rsc");
  const routerState = getHeader(headers, "next-router-state-tree");
  return rsc === "1" && !!routerState;
}

/**
 * Removes the internal Next.js cache-busting query param (_rsc by default).
 * Returns a relative URL (path + query + hash).
 */
export function stripRsc(inputUrl: string, paramName = "_rsc"): string {
  const url = new URL(inputUrl, "http://localhost");
  url.searchParams.delete(paramName);

  return (
    url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "")
  );
}

/**
 * Compute expected _rsc from headers, mirroring Next's computeCacheBustingSearchParam:
 * hash of: [prefetch, segmentPrefetch, stateTree, nextUrl].join(',')
 *
 * If the input signals are empty, returns '' (cannot compute reliably).
 */
export function computeExpectedRsc(
  headers: HeaderBag,
  opts?: RscGuardOptions
): string {
  const o = normalizeOptions(opts);

  const prefetch = getHeader(headers, o.routerPrefetchHeader) ?? "";
  const segmentPrefetch = getHeader(headers, o.segmentPrefetchHeader) ?? "";
  const stateTree = getHeader(headers, o.routerStateTreeHeader) ?? "";
  const nextUrl = getHeader(headers, o.nextUrlHeader) ?? "";

  const raw = [prefetch, segmentPrefetch, stateTree, nextUrl].join(",");

  if (!raw || raw === ",,,") return "";
  return nextHexHash(raw);
}

/**
 * Validates coherence of _rsc with Flight headers.
 *
 * - If _rsc is absent: pass
 * - If _rsc present but not Flight: strip/block (configurable)
 * - If Flight: compute expected and compare with provided (if present)
 */
export function validateRsc(
  inputUrl: string,
  headers: HeaderBag,
  opts?: RscGuardOptions
): RscValidationResult {
  const o = normalizeOptions(opts);

  const url = new URL(inputUrl, "http://localhost");
  const hasRscParam = url.searchParams.has(o.rscQueryParam);
  const providedRsc = url.searchParams.get(o.rscQueryParam) ?? undefined;

  if (!hasRscParam) {
    return { hasRscParam, isFlight: false, ok: true, action: "pass" };
  }

  const isFlight = (() => {
    const rsc = getHeader(headers, o.rscHeader);
    const tree = getHeader(headers, o.routerStateTreeHeader);
    if (rsc !== "1" || !tree) return false;

    if (o.requireAcceptRsc) {
      const accept = getHeader(headers, "accept");
      if (!accept || !accept.toLowerCase().includes("text/x-component"))
        return false;
    }

    return true;
  })();

  if (!isFlight) {
    const action = o.onNonFlightWithRsc;
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      ok: action !== "block",
      action,
      reason: "rsc_query_present_but_not_flight_request",
      strippedUrl:
        action === "strip" ? stripRsc(inputUrl, o.rscQueryParam) : undefined,
    };
  }

  const expectedRsc = computeExpectedRsc(headers, o);

  if (!expectedRsc) {
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      expectedRsc,
      ok: true,
      action: "pass",
      reason: "flight_request_but_expected_rsc_empty",
    };
  }

  if (!providedRsc) {
    const action = o.onMismatch;
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      expectedRsc,
      ok: action !== "block",
      action,
      reason: "flight_request_missing_rsc_value",
      strippedUrl:
        action === "strip" ? stripRsc(inputUrl, o.rscQueryParam) : undefined,
    };
  }

  if (providedRsc === expectedRsc) {
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      expectedRsc,
      ok: true,
      action: "pass",
    };
  }

  const action = o.onMismatch;
  return {
    hasRscParam,
    isFlight,
    providedRsc,
    expectedRsc,
    ok: action !== "block",
    action,
    reason: "flight_request_rsc_mismatch",
    strippedUrl:
      action === "strip" ? stripRsc(inputUrl, o.rscQueryParam) : undefined,
  };
}
