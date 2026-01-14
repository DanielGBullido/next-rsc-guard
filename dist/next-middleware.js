import {
  validateRsc
} from "./chunk-4JQRHG47.js";

// src/next-middleware.ts
async function guardNextMiddleware(req, opts) {
  const blockStatus = opts?.blockStatus ?? 404;
  const res = validateRsc(req.nextUrl.toString(), req.headers, opts);
  if (res.action === "pass") return void 0;
  if (res.action === "block") {
    const out = new Response(null, { status: blockStatus });
    if (opts?.debugHeaders) {
      out.headers.set("x-next-rsc-guard-action", "block");
      if (res.reason) out.headers.set("x-next-rsc-guard-reason", res.reason);
    }
    return out;
  }
  if (res.action === "strip" && res.strippedUrl) {
    const out = new Response(null, { status: 204 });
    out.headers.set("x-next-rsc-guard-rewrite", res.strippedUrl);
    if (opts?.debugHeaders) {
      out.headers.set("x-next-rsc-guard-action", "strip");
      if (res.reason) out.headers.set("x-next-rsc-guard-reason", res.reason);
    }
    return out;
  }
  return void 0;
}
function withRscGuard(handler, opts) {
  return async (req) => {
    const maybe = await guardNextMiddleware(req, opts);
    if (!maybe) return handler(req);
    const rewriteTo = maybe.headers.get("x-next-rsc-guard-rewrite");
    if (!rewriteTo) return maybe;
    const { NextResponse } = await import("next/server");
    const url = req.nextUrl.clone();
    const rewritten = new URL(rewriteTo, "http://localhost");
    url.search = rewritten.search;
    url.hash = rewritten.hash;
    const out = NextResponse.rewrite(url);
    const action = maybe.headers.get("x-next-rsc-guard-action");
    const reason = maybe.headers.get("x-next-rsc-guard-reason");
    if (action) out.headers.set("x-next-rsc-guard-action", action);
    if (reason) out.headers.set("x-next-rsc-guard-reason", reason);
    return out;
  };
}
export {
  guardNextMiddleware,
  withRscGuard
};
//# sourceMappingURL=next-middleware.js.map