import { describe, it, expect } from "vitest";
import { buildSharePreview, parseNameContent } from "./share-preview";
import type { SharePayload } from "./share-codec";

describe("parseNameContent", () => {
  it("parses full content format", () => {
    expect(parseNameContent("Al-Shafi (The Healer) - الشافي")).toEqual({
      english: "Al-Shafi",
      meaning: "The Healer",
      arabic: "الشافي",
    });
  });
  it("handles missing parts", () => {
    expect(parseNameContent("Al-Shafi")).toEqual({ english: "Al-Shafi", meaning: "", arabic: "" });
  });
});

describe("buildSharePreview", () => {
  it("dua with name", () => {
    const p: SharePayload = { v: 1, kind: "dua", item: { dua: "Ya Allah heal me", name: "Al-Shafi (The Healer) - الشافي" } };
    const r = buildSharePreview(p);
    expect(r.title).toBe("Al-Shafi · du'aOS");
    expect(r.lines).toHaveLength(1);
    expect(r.description).toContain("Ya Allah heal me");
    expect(r.description).toContain("Al-Shafi");
  });

  it("dua without name", () => {
    const p: SharePayload = { v: 1, kind: "dua", item: { dua: "Ya Allah" } };
    const r = buildSharePreview(p);
    expect(r.title).toBe("A du'a · du'aOS");
  });

  it("list of 5 yields 3 lines and count in title", () => {
    const p: SharePayload = {
      v: 1,
      kind: "list",
      title: "Ramadan",
      items: Array.from({ length: 5 }, (_, i) => ({ dua: `dua ${i}` })),
    };
    const r = buildSharePreview(p);
    expect(r.title).toBe("Ramadan · 5 du'as · du'aOS");
    expect(r.lines).toHaveLength(3);
  });

  it("truncates long dua text", () => {
    const p: SharePayload = { v: 1, kind: "dua", item: { dua: "x".repeat(500) } };
    const r = buildSharePreview(p);
    expect(r.description.length).toBeLessThanOrEqual(300);
    expect(r.description).toContain("…");
  });

  it("umrah list description gets prefix", () => {
    const p: SharePayload = { v: 1, kind: "list", title: "Du'as for Muhib", umrah: true, items: [{ dua: "stay safe" }] };
    const r = buildSharePreview(p);
    expect(r.title).toBe("Du'as for Muhib · 1 du'a · du'aOS");
    expect(r.description.startsWith("Du'as for your Umrah · ")).toBe(true);
  });

  it("request stays generic", () => {
    const p: SharePayload = { v: 1, kind: "request", request: { id: "r", text: "secret ask", at: "t" } };
    const r = buildSharePreview(p);
    expect(r.title).toBe("A du'a request · du'aOS");
    expect(r.lines).toHaveLength(0);
    expect(r.description).not.toContain("secret ask");
  });
});
