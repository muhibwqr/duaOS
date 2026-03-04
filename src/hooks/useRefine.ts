"use client";

import { useState, useCallback } from "react";
import type { SearchResult } from "@/types/dua";
import { buildHadithContext, buildQuranContext } from "@/lib/refine-context";
import { MAX_CONTEXT_LENGTH, MAX_REFINE_INPUT_LENGTH } from "@/lib/validation";

export function useRefine(
  setRefinedDua: (s: string) => void,
  setSaved: (b: boolean) => void
): { handleRefine: (query: string, refinedDua: string, searchResult: SearchResult | null) => Promise<void>; isRefining: boolean } {
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = useCallback(
    async (query: string, refinedDua: string, searchResult: SearchResult | null) => {
      const text = (query.trim() || refinedDua).slice(0, MAX_REFINE_INPUT_LENGTH);
      if (!text) return;
      const nameContent = (searchResult?.name?.content ?? "").slice(0, MAX_CONTEXT_LENGTH);
      const hadiths = searchResult?.hadiths ?? (searchResult?.hadith ? [searchResult.hadith] : []);
      const hadithContent = buildHadithContext(hadiths);
      const quranVerses = searchResult?.quranVerses ?? (searchResult?.quran ? [searchResult.quran] : []);
      const quranContent = buildQuranContext(quranVerses);
      setIsRefining(true);
      setRefinedDua("");
      setSaved(false);
      try {
        const res = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userInput: text,
            nameOfAllah: nameContent || undefined,
            hadith: hadithContent || undefined,
            quran: quranContent || undefined,
          }),
        });
        if (!res.ok) {
          let msg = "Something went wrong. Please try again.";
          try {
            const textRes = await res.text();
            const parsed = textRes.startsWith("{") ? JSON.parse(textRes) : null;
            const err = parsed?.error ?? textRes;
            if (res.status === 429) msg = "Too many requests. Please try again in a minute.";
            else if (res.status === 503) msg = "Service unavailable. Please try again later.";
            else if (res.status === 401) msg = "Service configuration error. Please try again later.";
            else if (typeof err === "string" && err.length > 0 && err.length < 200) msg = err;
          } catch {
            if (res.status === 429) msg = "Too many requests. Please try again in a minute.";
            else if (res.status === 503) msg = "Service unavailable. Please try again later.";
          }
          setRefinedDua(msg);
          return;
        }
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let out = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            out += chunk;
            setRefinedDua(out);
          }
        }
      } catch (e) {
        console.error(e);
        setRefinedDua("Something went wrong. Please try again.");
      } finally {
        setIsRefining(false);
      }
    },
    [setRefinedDua, setSaved]
  );

  return { handleRefine, isRefining };
}
