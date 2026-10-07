import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  getHistory,
  addHistory,
  updateHistoryRefined,
  removeHistory,
  clearHistory,
  HISTORY_KEY,
} from "./library-storage";
import type { SearchResult } from "@/types/dua";

const result: SearchResult = {
  name: { id: "n1", content: "Al-Shafi (The Healer) - الشافي", metadata: {} },
  hadith: null,
  hadiths: [],
};

beforeAll(() => {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: shim, configurable: true });
});

beforeEach(() => {
  localStorage.clear();
});

describe("search history", () => {
  it("adds entries newest-first with generated id/at", () => {
    const a = addHistory({ query: "patience", intent: "problem", result });
    const b = addHistory({ query: "health", intent: "problem", result });
    const list = getHistory();
    expect(list.map((h) => h.id)).toEqual([b.id, a.id]);
    expect(a.id).toBeTruthy();
    expect(a.at).toBeTruthy();
  });

  it("replaces the newest entry when query+intent match (normalized)", () => {
    const a = addHistory({ query: "exam stress", intent: "problem", result });
    const b = addHistory({ query: "  Exam   Stress ", intent: "problem", result });
    expect(b.id).toBe(a.id);
    const list = getHistory();
    expect(list.length).toBe(1);
    expect(list[0].query).toBe("  Exam   Stress ");
  });

  it("does not replace when intent differs or the match is not newest", () => {
    addHistory({ query: "exam", intent: "problem", result });
    addHistory({ query: "other", intent: "problem", result });
    const c = addHistory({ query: "exam", intent: "goal", result });
    const d = addHistory({ query: "exam", intent: "problem", result });
    const list = getHistory();
    expect(list.length).toBe(4);
    expect(list[0].id).toBe(d.id);
    expect(list[1].id).toBe(c.id);
  });

  it("caps at 50 entries", () => {
    for (let i = 0; i < 55; i++) addHistory({ query: `q${i}`, intent: "problem", result });
    const list = getHistory();
    expect(list.length).toBe(50);
    expect(list[0].query).toBe("q54");
    expect(list[49].query).toBe("q5");
  });

  it("updates and removes entries", () => {
    const a = addHistory({ query: "a", intent: "problem", result });
    updateHistoryRefined(a.id, "refined text");
    expect(getHistory()[0].refinedDua).toBe("refined text");
    removeHistory(a.id);
    expect(getHistory().length).toBe(0);
    expect(localStorage.getItem(HISTORY_KEY)).toBe("[]");
  });

  it("clearHistory empties storage", () => {
    addHistory({ query: "a", intent: "problem", result });
    clearHistory();
    expect(getHistory()).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});
