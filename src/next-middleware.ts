import { validateRsc, type RscGuardOptions } from "./index";

export interface NextMiddlewareGuardOptions extends RscGuardOptions {
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
export async function guardNextMiddleware(
  req: { nextUrl: URL; headers: Headers },
  opts?: NextMiddlewareGuardOptions
): Promise<Response | undefined> {
  const blockStatus = opts?.blockStatus ?? 404;
  const res = validateRsc(req.nextUrl.toString(), req.headers, opts);

  if (res.action === "pass") return undefined;

  // For "block" we return an empty response with status
  if (res.action === "block") {
    const out = new Response(null, { status: blockStatus });
    if (opts?.debugHeaders) {
      out.headers.set("x-next-rsc-guard-action", "block");
      if (res.reason) out.headers.set("x-next-rsc-guard-reason", res.reason);
    }
    return out;
  }

  // For "strip" we rewrite to URL without _rsc
  if (res.action === "strip" && res.strippedUrl) {
    // We must use NextResponse.rewrite in real middleware.
    // Here we return a marker response that withRscGuard will convert to NextResponse.rewrite.
    const out = new Response(null, { status: 204 });
    out.headers.set("x-next-rsc-guard-rewrite", res.strippedUrl);
    if (opts?.debugHeaders) {
      out.headers.set("x-next-rsc-guard-action", "strip");
      if (res.reason) out.headers.set("x-next-rsc-guard-reason", res.reason);
    }
    return out;
  }

  return undefined;
}

/**
 * Middleware wrapper that:
 * - runs the guard
 * - if guard indicates rewrite, uses NextResponse.rewrite
 * - otherwise runs your handler
 */
export function withRscGuard(
  handler: (req: any) => Response | Promise<Response>,
  opts?: NextMiddlewareGuardOptions
) {
  return async (req: any) => {
    const maybe = await guardNextMiddleware(req, opts);
    if (!maybe) return handler(req);

    const rewriteTo = maybe.headers.get("x-next-rsc-guard-rewrite");
    if (!rewriteTo) return maybe;

    // Lazy import to keep this entrypoint working only when used in Next projects
    const { NextResponse } = await import("next/server");

    const url = req.nextUrl.clone();
    const rewritten = new URL(rewriteTo, "http://localhost");
    url.search = rewritten.search; // keep params sans _rsc
    url.hash = rewritten.hash;

    const out = NextResponse.rewrite(url);

    // propagate debug headers if enabled
    const action = maybe.headers.get("x-next-rsc-guard-action");
    const reason = maybe.headers.get("x-next-rsc-guard-reason");
    if (action) out.headers.set("x-next-rsc-guard-action", action);
    if (reason) out.headers.set("x-next-rsc-guard-reason", reason);

    return out;
  };
}
