import { describe, it, expect } from "vitest";
import {
  searchBodySchema,
  refineBodySchema,
  storeDuaBodySchema,
  HADITH_EDITIONS,
  MAX_QUERY_LENGTH,
  MAX_CONTEXT_LENGTH,
} from "./validation";

describe("searchBodySchema", () => {
  it("accepts valid query and optional intent/edition", () => {
    const result = searchBodySchema.safeParse({ query: "patience in hardship" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("patience in hardship");
      expect(result.data.intent).toBeUndefined();
      expect(result.data.edition).toBe("");
    }
  });

  it("trims query and rejects empty after trim", () => {
    expect(searchBodySchema.safeParse({ query: "  " }).success).toBe(false);
    expect(searchBodySchema.safeParse({ query: "" }).success).toBe(false);
  });

  it("rejects query over MAX_QUERY_LENGTH", () => {
    const result = searchBodySchema.safeParse({ query: "x".repeat(MAX_QUERY_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it("accepts valid edition", () => {
    const result = searchBodySchema.safeParse({
      query: "guidance",
      edition: HADITH_EDITIONS[0],
    });
    expect(result.success).toBe(true);
  });
});

describe("refineBodySchema", () => {
  it("requires userInput and accepts optional context", () => {
    const result = refineBodySchema.safeParse({ userInput: "I need strength" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userInput).toBe("I need strength");
      expect(result.data.nameOfAllah).toBe("");
      expect(result.data.hadith).toBe("");
      expect(result.data.quran).toBe("");
    }
  });

  it("rejects empty userInput", () => {
    expect(refineBodySchema.safeParse({ userInput: "" }).success).toBe(false);
    expect(refineBodySchema.safeParse({ userInput: "   " }).success).toBe(false);
  });

  it("accepts optional nameOfAllah at max length", () => {
    const name = "Ar-Rahman ".repeat(200).slice(0, MAX_CONTEXT_LENGTH);
    const result = refineBodySchema.safeParse({
      userInput: "help",
      nameOfAllah: name,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nameOfAllah.length).toBeLessThanOrEqual(MAX_CONTEXT_LENGTH);
  });
});

describe("storeDuaBodySchema", () => {
  it("requires content and accepts optional fields", () => {
    const result = storeDuaBodySchema.safeParse({ content: "O Allah grant me patience" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    expect(storeDuaBodySchema.safeParse({ content: "" }).success).toBe(false);
  });
});
