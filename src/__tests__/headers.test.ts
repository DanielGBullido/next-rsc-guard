import { describe, it, expect } from "vitest";
import { getHeader, type HeaderBag } from "../headers";

describe("getHeader", () => {
  it("reads from Headers (case-insensitive)", () => {
    const h = new Headers();
    h.set("RSC", "1");
    expect(getHeader(h, "rsc")).toBe("1");
    expect(getHeader(h, "RSC")).toBe("1");
  });

  it("reads from object (supports both exact and lower-case keys)", () => {
    const obj = { rsc: "1", "next-router-state-tree": "{}" };
    expect(getHeader(obj, "rsc")).toBe("1");
    expect(getHeader(obj, "RSC")).toBe("1"); // via lower-case fallback
    expect(getHeader(obj, "next-router-state-tree")).toBe("{}");
  });

  it("reads from array tuples", () => {
    const arr: HeaderBag = [
      ["RSC", "1"],
      ["Next-Router-State-Tree", "{}"],
    ];
    expect(getHeader(arr, "rsc")).toBe("1");
    expect(getHeader(arr, "next-router-state-tree")).toBe("{}");
  });

  it("returns undefined if missing", () => {
    const obj = { foo: "bar" };
    expect(getHeader(obj, "rsc")).toBeUndefined();
  });
});
