import { validateRsc, computeExpectedRsc } from "./dist/index.js";

const headers = {
  rsc: "1",
  "next-router-state-tree": "{}",
  "next-router-prefetch": "1",
  "next-url": "/x",
};

const expected = computeExpectedRsc(headers);
console.log("expected:", expected);

console.log(
  validateRsc(`https://example.com/x?_rsc=${expected}&foo=1`, headers)
);

console.log(
  validateRsc(`https://example.com/x?_rsc=WRONG&foo=1`, headers)
);

console.log(
  validateRsc(`https://example.com/x?_rsc=WRONG&foo=1`, { rsc: "1" }) // not flight (missing state tree)
);
