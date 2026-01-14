# next-rsc-guard

Utilities to detect Next.js App Router Flight (RSC) requests and mitigate cache abuse involving the internal `_rsc` query parameter.

## Why

In Next.js App Router, `_rsc` is **not** an authenticity token. It is a cache-busting parameter intended to avoid cache collisions in some CDNs.

However, bots and misconfigured caches may generate large numbers of unique URLs by injecting `_rsc`, causing cache-key explosion and noisy traffic.

This library provides pragmatic validation:

- If `_rsc` is present but the request is not a Flight/RSC request → strip or block.
- If the request is a Flight/RSC request → compute the expected `_rsc` and compare → strip or block on mismatch.

## Install

```bash
npm install next-rsc-guard
```


Core API (any runtime)
```bash
import { isFlightRequest, validateRsc, stripRsc } from "next-rsc-guard";

// 1) Detect whether the request is a Flight / RSC request
const isFlight = isFlightRequest(req.headers);

// 2) Validate _rsc coherence
const result = validateRsc(req.url, req.headers, {
  onNonFlightWithRsc: "strip",
  onMismatch: "strip"
});

if (result.action === "block") {
  return new Response(null, { status: 404 });
}

if (result.action === "strip" && result.strippedUrl) {
  // Rewrite to result.strippedUrl in your proxy / CDN / middleware
}
```
Next.js Middleware

```bash
import { withRscGuard } from "next-rsc-guard/next-middleware";

export default withRscGuard(
  async () => {
    return new Response("ok");
  },
  {
    onNonFlightWithRsc: "strip",
    onMismatch: "strip",
    blockStatus: 404
  }
);

export const config = {
  matcher: ["/:path*"]
};
```
Notes

This library does not make _rsc secure. It only enforces coherence with Flight headers.

Header names and semantics may change across Next.js versions; options exist to override header and query names if needed.

The goal is to reduce cache abuse and noisy traffic, not to provide cryptographic guarantees.