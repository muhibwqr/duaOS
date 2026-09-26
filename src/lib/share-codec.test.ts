import { describe, it, expect } from "vitest";
import {
  encodeSharePayload,
  decodeSharePayload,
  buildShareUrl,
  extractShareCode,
  type SharePayload,
} from "./share-codec";

const duaPayload: SharePayload = {
  v: 1,
  kind: "dua",
  item: { dua: "O Allah, grant me patience", name: "As-Sabur", sources: ["Bukhari 1:2"], at: "2026-01-01T00:00:00.000Z" },
};

const listPayload: SharePayload = {
  v: 1,
  kind: "list",
  title: "My list",
  items: [
    { dua: "First dua" },
    { dua: "Second dua", name: "Ar-Rahman", sources: ["Muslim 3:4"] },
  ],
};

const requestPayload: SharePayload = {
  v: 1,
  kind: "request",
  request: { id: "abc-123", text: "Please make dua for my exams", name: "Al-Fattah", from: "Amina", at: "2026-01-01T00:00:00.000Z" },
};

describe("share-codec roundtrip", () => {
  it.each([
    ["dua", duaPayload],
    ["list", listPayload],
    ["request", requestPayload],
  ])("roundtrips kind=%s", async (_name, payload) => {
    const code = await encodeSharePayload(payload);
    expect(code).toMatch(/^[zj]\./);
    const decoded = await decodeSharePayload(code);
    expect(decoded).toEqual(payload);
  });
});

describe("decodeSharePayload", () => {
  it("returns null for garbage", async () => {
    expect(await decodeSharePayload("hello world")).toBeNull();
    expect(await decodeSharePayload("z.!!!not-base64")).toBeNull();
    expect(await decodeSharePayload("")).toBeNull();
    expect(await decodeSharePayload("z.aGVsbG8")).toBeNull(); // valid base64, invalid payload
  });

  it("returns null for unknown kind", async () => {
    const code = `j.${btoa(JSON.stringify({ v: 1, kind: "mystery", item: { dua: "x" } })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect(await decodeSharePayload(code)).toBeNull();
  });

  it("decodes a j.-prefixed plain payload", async () => {
    const payload = { v: 1, kind: "dua", item: { dua: "test dua" } };
    const code = `j.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect(await decodeSharePayload(code)).toEqual(payload);
  });

  it("accepts a full share URL", async () => {
    const code = await encodeSharePayload(duaPayload);
    expect(await decodeSharePayload(`https://duaos.com/s#${code}`)).toEqual(duaPayload);
    expect(await decodeSharePayload(`  ${code}  `)).toEqual(duaPayload);
  });
});

describe("extractShareCode", () => {
  it("extracts from URL", () => {
    expect(extractShareCode("https://duaos.com/s#z.abcDEF_-123")).toBe("z.abcDEF_-123");
    expect(extractShareCode("https://duaos.com/s/#z.abcDEF_-123")).toBe("z.abcDEF_-123");
  });
  it("extracts from ?c= search param on any path", () => {
    expect(extractShareCode("https://duaos.com/s?c=z.abcDEF_-123")).toBe("z.abcDEF_-123");
    expect(extractShareCode("https://duaos.com/s?c=j.aGVsbG8&x=1")).toBe("j.aGVsbG8");
  });
  it("prefers ?c= over hash", () => {
    expect(extractShareCode("https://duaos.com/s?c=j.AAA#z.BBB")).toBe("j.AAA");
  });
  it("extracts bare code", () => {
    expect(extractShareCode("j.abcDEF_-123")).toBe("j.abcDEF_-123");
  });
  it("returns null otherwise", () => {
    expect(extractShareCode("https://duaos.com/other#z.abc")).toBeNull();
    expect(extractShareCode("random text")).toBeNull();
    expect(extractShareCode("")).toBeNull();
  });
});

describe("buildShareUrl", () => {
  it("builds url with explicit origin (hash mode default)", () => {
    expect(buildShareUrl("z.abc", { origin: "https://duaos.com" })).toBe("https://duaos.com/s#z.abc");
    expect(buildShareUrl("z.abc", { origin: "https://duaos.com", mode: "hash" })).toBe("https://duaos.com/s#z.abc");
  });
  it("builds query-mode url", () => {
    expect(buildShareUrl("z.abc", { origin: "https://duaos.com", mode: "query" })).toBe("https://duaos.com/s?c=z.abc");
  });
});

describe("state payload", () => {
  it("roundtrips kind=state", async () => {
    const payload: SharePayload = {
      v: 1,
      kind: "state",
      library: [{ dua: "lib dua", name: "Al-Wakeel (The Trustee) - الوكيل" }],
      favorites: [{ dua: "fav dua" }],
      lists: [{ id: "l1", title: "Morning", items: [{ dua: "m1" }], at: "2026-01-01T00:00:00.000Z" }],
      requests: [{ id: "r1", text: "pray for me", at: "2026-01-01T00:00:00.000Z" }],
    };
    expect(await decodeSharePayload(await encodeSharePayload(payload))).toEqual(payload);
  });

  it("roundtrips list with id", async () => {
    const payload: SharePayload = { v: 1, kind: "list", id: "l9", title: "T", items: [{ dua: "x" }] };
    expect(await decodeSharePayload(await encodeSharePayload(payload))).toEqual(payload);
  });

  it("rejects malformed state", async () => {
    const bad = `j.${btoa(JSON.stringify({ v: 1, kind: "state", library: [], favorites: [], lists: [{ title: "no id", items: [] }], requests: [] })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect(await decodeSharePayload(bad)).toBeNull();
  });
});
