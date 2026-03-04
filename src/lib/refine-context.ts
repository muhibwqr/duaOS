/**
 * Build hadith and Quran context strings for the refine API from search results.
 */

import type { SearchResultItem } from "@/types/dua";

/** Base du'a for being in need of any good Allah gives — Prophet Musa (AS), Quran 28:24. Include when user asks for spouse, marriage, or any good from Allah. */
export const BASE_DUA_NEED_OF_GOOD = `رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ
My Lord, indeed I am, for whatever good You would send down to me, in need. [Al-Qasas 28:24]`;

/** Keywords that indicate the user is asking for spouse/marriage or "any good" — we then inject the base du'a of need. */
const NEED_OF_GOOD_INTENT_KEYWORDS = [
  "wife",
  "husband",
  "spouse",
  "marriage",
  "nikah",
  "partner",
  "righteous companion",
  "getting married",
  "find a spouse",
  "any good",
  "whatever good",
  "in need",
  "need good",
  "khayr",
  "rizq",
  "provision",
];

/**
 * Returns true if the user intent suggests asking for a spouse/marriage or for any good from Allah,
 * so we should include the base du'a of Musa (28:24) in context.
 */
export function shouldIncludeBaseDuaNeedOfGood(userInput: string): boolean {
  const lower = userInput.toLowerCase().trim();
  return NEED_OF_GOOD_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}
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
