"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/next-middleware.ts
var next_middleware_exports = {};
__export(next_middleware_exports, {
  guardNextMiddleware: () => guardNextMiddleware,
  withRscGuard: () => withRscGuard
});
module.exports = __toCommonJS(next_middleware_exports);

// src/headers.ts
function getHeader(headers, name) {
  const key = name.toLowerCase();
  if (typeof headers.get === "function") {
    return headers.get(key) ?? void 0;
  }
  if (Array.isArray(headers)) {
    const hit = headers.find(([k]) => k.toLowerCase() === key);
    return hit?.[1];
  }
  const obj = headers;
  return obj[name] ?? obj[key];
}

// src/hash.ts
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}
function nextHexHash(str) {
  return djb2Hash(str).toString(36).slice(0, 5);
}

// src/rsc.ts
function normalizeOptions(opts) {
  return {
    rscQueryParam: "_rsc",
    rscHeader: "rsc",
    routerStateTreeHeader: "next-router-state-tree",
    routerPrefetchHeader: "next-router-prefetch",
    segmentPrefetchHeader: "next-router-segment-prefetch",
    nextUrlHeader: "next-url",
    requireAcceptRsc: false,
    onNonFlightWithRsc: "strip",
    onMismatch: "strip",
    ...opts
  };
}
function stripRsc(inputUrl, paramName = "_rsc") {
  const url = new URL(inputUrl, "http://localhost");
  url.searchParams.delete(paramName);
  return url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
}
function computeExpectedRsc(headers, opts) {
  const o = normalizeOptions(opts);
  const prefetch = getHeader(headers, o.routerPrefetchHeader) ?? "";
  const segmentPrefetch = getHeader(headers, o.segmentPrefetchHeader) ?? "";
  const stateTree = getHeader(headers, o.routerStateTreeHeader) ?? "";
  const nextUrl = getHeader(headers, o.nextUrlHeader) ?? "";
  const raw = [prefetch, segmentPrefetch, stateTree, nextUrl].join(",");
  if (!raw || raw === ",,,") return "";
  return nextHexHash(raw);
}
function validateRsc(inputUrl, headers, opts) {
  const o = normalizeOptions(opts);
  const url = new URL(inputUrl, "http://localhost");
  const hasRscParam = url.searchParams.has(o.rscQueryParam);
  const providedRsc = url.searchParams.get(o.rscQueryParam) ?? void 0;
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
    const action2 = o.onNonFlightWithRsc;
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      ok: action2 !== "block",
      action: action2,
      reason: "rsc_query_present_but_not_flight_request",
      strippedUrl: action2 === "strip" ? stripRsc(inputUrl, o.rscQueryParam) : void 0
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
      reason: "flight_request_but_expected_rsc_empty"
    };
  }
  if (!providedRsc) {
    const action2 = o.onMismatch;
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      expectedRsc,
      ok: action2 !== "block",
      action: action2,
      reason: "flight_request_missing_rsc_value",
      strippedUrl: action2 === "strip" ? stripRsc(inputUrl, o.rscQueryParam) : void 0
    };
  }
  if (providedRsc === expectedRsc) {
    return {
      hasRscParam,
      isFlight,
      providedRsc,
      expectedRsc,
      ok: true,
      action: "pass"
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
    strippedUrl: action === "strip" ? stripRsc(inputUrl, o.rscQueryParam) : void 0
  };
}

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  guardNextMiddleware,
  withRscGuard
});
//# sourceMappingURL=next-middleware.cjs.map