/**
 * Build hadith and Quran context strings for the refine API from search results.
 */

import type { SearchResultItem } from "@/types/dua";
import { MAX_HADITH_CONTEXT_LENGTH } from "@/lib/validation";

const SHOW_FULL_HADITH = 3;

export function buildHadithContext(hadiths: SearchResultItem[]): string {
  const withRef = hadiths.filter(
    (m) => typeof m.metadata?.reference === "string" && (m.metadata.reference as string).trim() !== ""
  );
  if (!withRef.length) return "";
  const ref = (m: SearchResultItem) => (typeof m.metadata?.reference === "string" ? m.metadata.reference : "");
  const parts: string[] = [];
  for (let i = 0; i < withRef.length; i++) {
    if (i < SHOW_FULL_HADITH) {
      const r = ref(withRef[i]);
      parts.push(r ? `${withRef[i].content} [${r}]` : withRef[i].content);
    } else {
      parts.push(ref(withRef[i]) || `Hadith ${i + 1}`);
    }
  }
  const moreRefs =
    withRef.length > SHOW_FULL_HADITH
      ? `\nAlso relevant (by relevance): ${parts.slice(SHOW_FULL_HADITH).join(", ")}`
      : "";
  return (parts.slice(0, SHOW_FULL_HADITH).join("\n\n") + moreRefs).slice(0, MAX_HADITH_CONTEXT_LENGTH);
}

export function buildQuranContext(verses: SearchResultItem[]): string {
  const withRef = verses.filter(
    (v) =>
      (typeof v.metadata?.reference === "string" && (v.metadata.reference as string).trim() !== "") ||
      (typeof v.metadata?.surah === "string" && (v.metadata.surah as string).trim() !== "")
  );
  if (!withRef.length) return "";
  const parts: string[] = [];
  for (let i = 0; i < Math.min(withRef.length, 5); i++) {
    const v = withRef[i];
    const surah = typeof v.metadata?.surah === "string" ? v.metadata.surah : "";
    const ref = typeof v.metadata?.reference === "string" ? v.metadata.reference : "";
    const source = [surah, ref].filter(Boolean).join(" ").trim();
    parts.push(source ? `${v.content} [${source}]` : v.content);
  }
  return parts.join("\n\n").slice(0, MAX_HADITH_CONTEXT_LENGTH);
}
