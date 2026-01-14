type HeaderBag = Headers | Record<string, string | undefined> | Array<[string, string]>;
declare function getHeader(headers: HeaderBag, name: string): string | undefined;

type RscGuardAction = "pass" | "strip" | "block";
interface RscGuardOptions {
    rscQueryParam?: string;
    rscHeader?: string;
    routerStateTreeHeader?: string;
    routerPrefetchHeader?: string;
    segmentPrefetchHeader?: string;
    nextUrlHeader?: string;
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
interface RscValidationResult {
    hasRscParam: boolean;
    isFlight: boolean;
    expectedRsc?: string;
    providedRsc?: string;
    ok: boolean;
    action: RscGuardAction;
    reason?: string;
    strippedUrl?: string;
}
/**
 * Minimal heuristic:
 * - rsc: "1"
 * - next-router-state-tree present
 */
declare function isFlightRequest(headers: HeaderBag): boolean;
/**
 * Removes the internal Next.js cache-busting query param (_rsc by default).
 * Returns a relative URL (path + query + hash).
 */
declare function stripRsc(inputUrl: string, paramName?: string): string;
/**
 * Compute expected _rsc from headers, mirroring Next's computeCacheBustingSearchParam:
 * hash of: [prefetch, segmentPrefetch, stateTree, nextUrl].join(',')
 *
 * If the input signals are empty, returns '' (cannot compute reliably).
 */
declare function computeExpectedRsc(headers: HeaderBag, opts?: RscGuardOptions): string;
/**
 * Validates coherence of _rsc with Flight headers.
 *
 * - If _rsc is absent: pass
 * - If _rsc present but not Flight: strip/block (configurable)
 * - If Flight: compute expected and compare with provided (if present)
 */
declare function validateRsc(inputUrl: string, headers: HeaderBag, opts?: RscGuardOptions): RscValidationResult;

export { type HeaderBag, type RscGuardAction, type RscGuardOptions, type RscValidationResult, computeExpectedRsc, getHeader, isFlightRequest, stripRsc, validateRsc };
