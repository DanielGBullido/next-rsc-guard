// src/index.ts
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
function isFlightRequest(headers) {
  const rsc = getHeader(headers, "rsc");
  const routerState = getHeader(headers, "next-router-state-tree");
  return rsc === "1" && !!routerState;
}
function stripRsc(inputUrl, paramName = "_rsc") {
  const url = new URL(inputUrl, "http://localhost");
  url.searchParams.delete(paramName);
  return url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
}
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
      if (!accept || !accept.toLowerCase().includes("text/x-component")) return false;
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

export {
  isFlightRequest,
  stripRsc,
  computeExpectedRsc,
  validateRsc
};
//# sourceMappingURL=chunk-2ZNMYK7A.js.map