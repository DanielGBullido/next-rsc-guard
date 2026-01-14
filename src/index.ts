/**
 * next-rsc-guard (core)
 *
 * Validates coherence of Next.js App Router RSC (_rsc) cache-busting param
 * with Flight request headers.
 *
 * Important:
 * - _rsc is NOT a security token in Next.js.
 * - This library provides pragmatic validation to mitigate bots / cache explosion.
 */

export type { HeaderBag } from "./headers";
export { getHeader } from "./headers";

export type {
  RscGuardAction,
  RscGuardOptions,
  RscValidationResult,
} from "./rsc";
export {
  isFlightRequest,
  stripRsc,
  computeExpectedRsc,
  validateRsc,
} from "./rsc";
