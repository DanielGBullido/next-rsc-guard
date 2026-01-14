# next-rsc-guard

Utilities to detect Next.js App Router Flight (RSC) requests and mitigate cache abuse involving the internal `_rsc` query parameter.

## Why

In Next.js App Router, `_rsc` is **not** an authenticity token. It is a cache-busting parameter intended to avoid cache collisions in some CDNs.

However, bots and misconfigured caches may generate large numbers of unique URLs by injecting `_rsc`, causing cache-key explosion and noisy traffic.

This library provides pragmatic validation:

- If `_rsc` is present but the request is not a Flight/RSC request → strip or block.
- If the request is a Flight/RSC request → compute the expected `_rsc` and compare → strip or block on mismatch.

# Install

```bash
npm install next-rsc-guard
```

# ⚠️ Important: \_rsc is hidden by Next.js middleware

In Next.js App Router, the internal \_rsc query parameter is not always visible in Middleware / Edge runtime.

When a request reaches middleware.ts (or a custom Proxy using NextRequest), Next.js may strip or normalize \_rsc before exposing the request URL.

As a result:

- request.url may not include \_rsc
- request.nextUrl.searchParams.has("\_rsc") may return false
- Even if the client requested:

```bash
/products?_rsc=abc123
```

This behavior is intentional and consistent with Next.js design:
RSC behavior is determined by request headers, not by trusting the \_rsc query parameter.

#### Why this matters

Many cache-abuse and bot scenarios involve injecting \_rsc directly into HTML URLs.
Because \_rsc may be hidden at middleware level, the origin application cannot reliably detect these cases using request.url alone.

#### Recommended approach

To validate or normalize the real URL received by the CDN or edge layer, you must provide the original URI explicitly.

#### Common approaches include:

- Passing the original request URI via a header (for example X-Original-URI)
- Performing \_rsc stripping or blocking directly at the CDN / edge (Fastly, Cloudflare, etc.)

#### Example: using X-Original-URI

If your CDN forwards the original path and query string in a header:

```bash
X-Original-URI: /products?_rsc=abc123
```

You can validate against the real URL like this:

```bash
const originalUri = request.headers.get("x-original-uri");

const inputUrl = originalUri
  ? new URL(originalUri, request.nextUrl.origin).toString()
  : request.url;

const result = validateRsc(inputUrl, request.headers, {
  onNonFlightWithRsc: "strip",
  onMismatch: "pass",
});
```

This allows next-rsc-guard to:

- Detect **\_rsc** even when Next.js hides it from **request.url**
- Correctly identify bot / non-Flight abuse
- Safely strip or block **\_rsc** before the request is processed further

#### Security note

If you rely on headers such as **X-Original-URI**, ensure they are only trusted when injected by your CDN or reverse proxy, not by arbitrary clients.

# Core API (any runtime)

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

# Next.js Middleware

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

# Validation result

**validateRsc()** returns a structured result describing how the request was interpreted and what action is recommended.

```bash
interface RscValidationResult {
  hasRscParam: boolean;
  isFlight: boolean;
  expectedRsc?: string;
  providedRsc?: string;
  ok: boolean;
  action: "pass" | "strip" | "block";
  reason?: string;
  strippedUrl?: string;
}
```

# Field semantics

#### hasRscParam

- **true** → the URL contains \_rsc
- **false** → no \_rsc present

#### isFlight

Indicates whether the request appears to be a legitimate Next.js Flight / RSC request.

It is **true** only when required RSC headers are present (for example **rsc: 1** and **next-router-state-tree**).

#### providedRsc

The **\_rsc** value received in the URL, if present.

Example:

```bash
/es/ropa?_rsc=1f9f4
```

#### expectedRsc

The **\_rsc** value computed by the server from Flight headers, using the same non-cryptographic hash algorithm as Next.js.

If headers are incomplete, this value may be empty or undefined.

#### action

Recommended action to take:

- **"pass"**
  No action required. The request is coherent.

- **"strip"**
  Remove \_rsc from the URL and continue.
  Typical case: \_rsc injected into non-Flight requests.

- **"block"**
  Block the request (for example with 404 or 400).
  Only returned when explicitly configured.

#### ok

Indicates whether the request should be allowed to continue.

**true** → pass or strip

**false** → block

#### reason

Machine-readable explanation of the decision. Possible values include:

- **rsc_query_present_but_not_flight_request_rsc** present, but request is not a Flight request.

- **flight_request_but_expected_rsc_empty**
  Flight request, but expected \_rsc could not be computed.

- **flight_request_missing_rsc_value**
  Flight request without \_rsc value.

- **flight_request_rsc_mismatch**
  Flight request with \_rsc that does not match the expected value.

#### strippedUrl

The URL with **\_rsc** removed, when **action === "strip"**.

Example:

```bash
/api/test?_rsc=1f9f4&foo=1
→ /api/test?foo=1
```

---

## Notes

This library does not make \_rsc secure. It only enforces coherence with Flight headers.

Next.js determines RSC behavior by headers, not by trusting \_rsc.

Header names and semantics may change across Next.js versions; options exist to override header and query names if needed.

The goal is to reduce cache abuse and noisy traffic, not to provide cryptographic guarantees.
