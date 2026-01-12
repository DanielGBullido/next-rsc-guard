import { RscGuardOptions } from './index.cjs';

interface NextMiddlewareGuardOptions extends RscGuardOptions {
    /**
     * If action === "block", which status to return.
     * Default: 404
     */
    blockStatus?: number;
    /**
     * If true, add a small debug header (reason/action) on rewritten/blocked responses.
     * Default: false
     */
    debugHeaders?: boolean;
}
/**
 * Guards a Next.js middleware request.
 *
 * Returns:
 * - undefined if request should proceed
 * - a Response (rewrite or block) if action is needed
 *
 * NOTE: We intentionally do not import NextResponse directly in the core package build.
 * Users will call this from middleware and pass NextResponse in helper below,
 * or use withRscGuard which lazily imports next/server at runtime.
 */
declare function guardNextMiddleware(req: {
    nextUrl: URL;
    headers: Headers;
}, opts?: NextMiddlewareGuardOptions): Promise<Response | undefined>;
/**
 * Middleware wrapper that:
 * - runs the guard
 * - if guard indicates rewrite, uses NextResponse.rewrite
 * - otherwise runs your handler
 */
declare function withRscGuard(handler: (req: any) => Response | Promise<Response>, opts?: NextMiddlewareGuardOptions): (req: any) => Promise<Response>;

export { type NextMiddlewareGuardOptions, guardNextMiddleware, withRscGuard };
