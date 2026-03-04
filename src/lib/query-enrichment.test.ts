import { describe, it, expect } from "vitest";
import { enrichQuery } from "./query-enrichment";

const PREFIX = "du'a supplication asking Allah for: ";

describe("enrichQuery", () => {
  it("prefixes every query with du'a intent", () => {
    const out = enrichQuery("something random");
    expect(out.startsWith(PREFIX)).toBe(true);
    expect(out).toBe(PREFIX + "something random");
  });

  it("expands known single-word topics", () => {
    const out = enrichQuery("patience");
    expect(out.startsWith(PREFIX)).toBe(true);
    expect(out).toContain("patience");
    expect(out).toContain("sabr");
    expect(out).toContain("steadfastness");
  });

  it("expands known phrases", () => {
    const out = enrichQuery("finding love");
    expect(out).toContain("marriage");
    expect(out).toContain("spouse");
    expect(out).toContain("nikah");
  });

  it("trims and normalizes whitespace", () => {
    const out = enrichQuery("  patience  ");
    expect(out.startsWith(PREFIX)).toBe(true);
    expect(out.toLowerCase()).toContain("patience");
  });

  it("returns prefix + query when no topic match", () => {
    const out = enrichQuery("xyz unknown topic");
    expect(out).toBe(PREFIX + "xyz unknown topic");
  });
});
