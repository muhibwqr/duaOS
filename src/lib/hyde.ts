/**
 * HyDE (Hypothetical Document Embeddings) for short queries.
 * Generates a hypothetical du'a/hadith-style passage and returns it for embedding.
 * Used when the user query is very short to improve vector recall.
 */

import OpenAI from "openai";

const SHORT_QUERY_WORD_THRESHOLD = 12;

const HYDE_SYSTEM =
  "You are helping improve search for an Islamic du'a app. Generate one short paragraph (2–4 sentences) that might appear in an authentic hadith or du'a about the given intention. Write in a traditional, supplicatory style. English only. No citations or verse numbers. No preamble—output only the hypothetical passage.";

export function isShortQuery(query: string): boolean {
  const words = query.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= SHORT_QUERY_WORD_THRESHOLD;
}

export async function generateHypotheticalDocument(
  openai: OpenAI,
  userQuery: string
): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: HYDE_SYSTEM },
      { role: "user", content: `Intention: ${userQuery.trim().slice(0, 500)}` },
    ],
    temperature: 0.3,
    max_tokens: 150,
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  return text.slice(0, 1000);
}

/** Blend query and HyDE embeddings (element-wise average). */
export function blendEmbeddings(queryEmbedding: number[], hydeEmbedding: number[]): number[] {
  if (queryEmbedding.length !== hydeEmbedding.length) return queryEmbedding;
  return queryEmbedding.map((q, i) => (q + hydeEmbedding[i]) / 2);
}
