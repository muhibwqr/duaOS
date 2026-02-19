/**
 * LLM-based selection of hadiths and Quran verses that are accurate du'as for the user's intent.
 * One gpt-5-nano call after vector search to filter out tangential rulings or weak matches.
 * gpt-5-nano is the most cost- and latency-efficient model for this classification-style task.
 */

import OpenAI from "openai";
import type { MatchRow } from "@/lib/rerank-dua-intent";

const MAX_CONTENT_SNIPPET = 220;

function snippet(text: string): string {
  const t = (text || "").trim();
  if (t.length <= MAX_CONTENT_SNIPPET) return t;
  return t.slice(0, MAX_CONTENT_SNIPPET) + "...";
}

function buildHadithList(hadiths: MatchRow[]): string {
  return hadiths
    .map((h, i) => {
      const ref = typeof h.metadata?.reference === "string" ? h.metadata.reference : "";
      return `${i + 1}. id: ${h.id}\n   content: ${snippet(h.content)}\n   reference: ${ref}`;
    })
    .join("\n\n");
}

function buildQuranList(verses: MatchRow[]): string {
  return verses
    .map((v, i) => {
      const ref = typeof v.metadata?.reference === "string" ? v.metadata.reference : "";
      const surah = typeof v.metadata?.surah === "string" ? v.metadata.surah : "";
      return `${i + 1}. id: ${v.id}\n   content: ${snippet(v.content)}\n   reference: ${[surah, ref].filter(Boolean).join(" ")}`;
    })
    .join("\n\n");
}

const SYSTEM_PROMPT = `You are a precision filter for a du'a (Islamic supplication) search tool. Given a user's intention and a list of hadiths and Quran verses from vector search, you must return ONLY the ids of items that are genuine, relevant supplications the user could recite for that intent.

Include an item ONLY if:
- It is an actual du'a or supplication (something to pray/recite), OR a verse/hadith that is commonly used as a du'a for this topic.
- It clearly matches the user's intent (e.g. marriage = du'as for spouse/marriage, not rulings about divorce or widow remarriage).

Exclude an item if:
- It is a fiqh ruling, legal ruling, or narrative that only mentions the keyword tangentially.
- It is not something one would recite as a du'a for this intention.

Respond with valid JSON only, no other text:
{"hadith_ids": ["uuid1", "uuid2", ...], "quran_ids": ["uuid3", ...]}
Use the exact ids from the lists. Return empty arrays if none are relevant. Preserve order by relevance (most relevant first).`;

export type SelectRelevantDuasResult = { hadithIds: string[]; quranIds: string[] };

/**
 * Call LLM to select which hadith and Quran ids are accurate du'as for the user's intent.
 * On failure or parse error, returns full original ids so the API can fall back to unfiltered results.
 */
export async function selectRelevantDuas(
  query: string,
  hadiths: MatchRow[],
  quranVerses: MatchRow[],
  options: { apiKey?: string; skip?: boolean } = {}
): Promise<SelectRelevantDuasResult> {
  const { apiKey = process.env.OPENAI_API_KEY, skip = false } = options;

  const fallback: SelectRelevantDuasResult = {
    hadithIds: hadiths.map((h) => h.id).filter(Boolean),
    quranIds: quranVerses.map((v) => v.id).filter(Boolean),
  };

  if (skip || !apiKey) {
    return fallback;
  }
  if (hadiths.length === 0 && quranVerses.length === 0) {
    return fallback;
  }

  const userPrompt = `User's du'a intention: "${query.trim()}"

Hadiths (return only ids of items that are relevant supplications for this intent):
${buildHadithList(hadiths)}

Quran verses (return only ids of items that are relevant supplications for this intent):
${buildQuranList(quranVerses)}

Respond with JSON: {"hadith_ids": [...], "quran_ids": [...]}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as { hadith_ids?: unknown; quran_ids?: unknown };
    const hadithIds = Array.isArray(parsed.hadith_ids)
      ? (parsed.hadith_ids as string[]).filter((id) => typeof id === "string")
      : fallback.hadithIds;
    const quranIds = Array.isArray(parsed.quran_ids)
      ? (parsed.quran_ids as string[]).filter((id) => typeof id === "string")
      : fallback.quranIds;

    if (hadithIds.length === 0 && quranIds.length === 0) return fallback;

    return { hadithIds, quranIds };
  } catch {
    return fallback;
  }
}

/**
 * Filter and reorder hadiths and quranVerses to match the LLM-selected ids.
 * Preserves order of ids. Items not in the id list are dropped.
 */
export function applySelectedIds(
  hadiths: MatchRow[],
  quranVerses: MatchRow[],
  selected: SelectRelevantDuasResult
): { hadiths: MatchRow[]; quranVerses: MatchRow[] } {
  const hadithById = new Map(hadiths.map((h) => [h.id, h]));
  const quranById = new Map(quranVerses.map((v) => [v.id, v]));

  const hadithsFiltered = selected.hadithIds
    .map((id) => hadithById.get(id))
    .filter((h): h is MatchRow => h != null);
  const quranFiltered = selected.quranIds
    .map((id) => quranById.get(id))
    .filter((v): v is MatchRow => v != null);

  return {
    hadiths: hadithsFiltered.length > 0 ? hadithsFiltered : hadiths,
    quranVerses: quranFiltered.length > 0 ? quranFiltered : quranVerses,
  };
}
