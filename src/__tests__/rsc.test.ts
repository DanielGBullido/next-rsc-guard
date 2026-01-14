import { describe, it, expect } from "vitest";
import {
  isFlightRequest,
  stripRsc,
  computeExpectedRsc,
  validateRsc,
} from "../rsc";

describe("RSC guard core", () => {
  it("isFlightRequest: true when rsc=1 and next-router-state-tree present", () => {
    const headers = {
      rsc: "1",
      "next-router-state-tree": "{}",
    };
    expect(isFlightRequest(headers)).toBe(true);
  });

  it("isFlightRequest: false when missing next-router-state-tree", () => {
    const headers = { rsc: "1" };
    expect(isFlightRequest(headers)).toBe(false);
  });

  it("stripRsc: removes _rsc from absolute and relative URLs", () => {
    expect(stripRsc("https://example.com/x?_rsc=abc&foo=1")).toBe("/x?foo=1");
    expect(stripRsc("/x?_rsc=abc&foo=1#h")).toBe("/x?foo=1#h");
  });

  it("computeExpectedRsc: returns stable 5-char base36 hash when inputs present", () => {
    const headers = {
      rsc: "1",
      "next-router-state-tree": "{}",
      "next-router-prefetch": "1",
      "next-url": "/x",
    };

    const expected = computeExpectedRsc(headers);
    expect(typeof expected).toBe("string");
    expect(expected.length).toBe(5);
  });

  it("validateRsc: pass when _rsc absent", () => {
    const headers = { rsc: "1", "next-router-state-tree": "{}" };
    const result = validateRsc("https://example.com/x?foo=1", headers);
    expect(result.action).toBe("pass");
    expect(result.ok).toBe(true);
  });

  it("validateRsc: strip when _rsc present but request is not Flight", () => {
    const headers = { rsc: "1" }; // missing tree => not Flight
    const result = validateRsc(
      "https://example.com/x?_rsc=abc&foo=1",
      headers,
      {
        onNonFlightWithRsc: "strip",
      }
    );
    expect(result.action).toBe("strip");
    expect(result.reason).toBe("rsc_query_present_but_not_flight_request");
    expect(result.strippedUrl).toBe("/x?foo=1");
  });

  it("validateRsc: pass when Flight and _rsc matches expected", () => {
    const headers = {
      rsc: "1",
      "next-router-state-tree": "{}",
      "next-router-prefetch": "1",
      "next-url": "/x",
    };

    const expected = computeExpectedRsc(headers);
    const result = validateRsc(
      `https://example.com/x?_rsc=${expected}&foo=1`,
      headers
    );

    expect(result.action).toBe("pass");
    expect(result.ok).toBe(true);
    expect(result.expectedRsc).toBe(expected);
    expect(result.providedRsc).toBe(expected);
  });

  it("validateRsc: strip when Flight and _rsc mismatches expected", () => {
    const headers = {
      rsc: "1",
      "next-router-state-tree": "{}",
      "next-router-prefetch": "1",
      "next-url": "/x",
    };

    const expected = computeExpectedRsc(headers);
    expect(expected).not.toBe("WRONG");

    const result = validateRsc(
      "https://example.com/x?_rsc=WRONG&foo=1",
      headers,
      {
        onMismatch: "strip",
      }
    );

    expect(result.action).toBe("strip");
    expect(result.reason).toBe("flight_request_rsc_mismatch");
    expect(result.strippedUrl).toBe("/x?foo=1");
    expect(result.expectedRsc).toBe(expected);
    expect(result.providedRsc).toBe("WRONG");
  });
});
