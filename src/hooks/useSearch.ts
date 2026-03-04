"use client";

import { useState, useCallback } from "react";
import { localMatch } from "@/lib/local-match";
import namesOfAllah from "@/data/names-of-allah.json";
import type { SearchResult } from "@/types/dua";
import { MAX_QUERY_LENGTH } from "@/lib/validation";

const namesList = namesOfAllah as { arabic: string; english: string; meaning: string; tags: string[] }[];

export function useSearch(
  setSearchResult: (r: SearchResult | null) => void,
  setRefinedDua: (s: string) => void,
  setUsedFailsafe: (b: boolean) => void
): {
  handleSearch: (query: string, intent: string, edition: string) => Promise<void>;
  isSearching: boolean;
  searchError: string | null;
  setSearchError: (s: string | null) => void;
} {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (query: string, intent: string, edition: string) => {
      const q = query.trim().slice(0, MAX_QUERY_LENGTH);
      if (!q) return;
      setSearchResult(null);
      setSearchError(null);
      setRefinedDua("");
      const local = localMatch(q, namesList);
      setIsSearching(true);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, intent, edition: edition || undefined }),
        });
        const text = await res.text();
        if (!res.ok) {
          let msg = text;
          try {
            const j = JSON.parse(text);
            if (j.error) msg = j.error;
          } catch {
            // use raw text
          }
          setSearchError(msg);
          setSearchResult({ name: null, hadith: null, hadiths: [] });
          return;
        }
        const data = JSON.parse(text);
        const hadithList = Array.isArray(data.hadiths) ? data.hadiths : data.hadith ? [data.hadith] : [];
        const quranList = Array.isArray(data.quranVerses) ? data.quranVerses : data.quran ? [data.quran] : [];
        setUsedFailsafe(true);
        setSearchResult({
          name: data.name ?? local?.name ?? null,
          hadith: data.hadith ?? hadithList[0] ?? null,
          hadiths: hadithList,
          quran: data.quran ?? null,
          quranVerses: quranList,
        });
      } catch (e) {
        console.error(e);
        if (local) {
          setUsedFailsafe(false);
          setSearchError("Search service unavailable. Showing local Name match.");
          setSearchResult({
            name: local.name,
            hadith: local.hadith,
            hadiths: [],
            quran: local.quran ?? null,
          });
        } else {
          setSearchError(e instanceof Error ? e.message : "Search failed. Check your connection and try again.");
          setSearchResult({ name: null, hadith: null, hadiths: [] });
        }
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchResult, setRefinedDua, setUsedFailsafe]
  );

  return { handleSearch, isSearching, searchError, setSearchError };
}
