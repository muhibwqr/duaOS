/**
 * Re-rank vector search results for du'a intent: boost supplication content,
 * penalize jurisprudence/ruling content, and boost curated assets.
 * Works for all topics (marriage, patience, anxiety, forgiveness, etc.).
 */

const BOOST_MULTIPLIER = 1.2;
const PENALTY_MULTIPLIER = 0.75;
const CURATED_BOOST = 1.1;

const DUA_OPENINGS = [
  "o allah",
  "our lord",
  "rabbana",
  "rabbi",
  "allahumma",
  "my lord",
  "o turner of hearts",
  "o bestower",
  "o forgiver",
  "o merciful",
  "o most merciful",
  "o ever-living",
  "o self-sustaining",
  "sufficient for me is allah",
  "there is no god but you",
  "in the name of allah",
];

const SUPPLICATION_PHRASES = [
  "grant me",
  "grant us",
  "protect us",
  "protect me",
  "forgive me",
  "forgive us",
  "guide me",
  "guide us",
  "i ask you",
  "i seek refuge",
  "pour upon us",
  "have mercy",
  "bless me",
  "bless us",
  "give us",
  "give me",
  "help me",
  "help us",
  "accept",
  "purify",
  "cleans",
  "relief",
  "ease",
  "healing",
  "shifa",
  "comfort",
  "content",
  "steadfast",
  "patience",
  "sabr",
];

const JURISPRUDENCE_PHRASES = [
  "is permissible",
  "is forbidden",
  "it is not allowed",
  "the ruling",
  "waiting period",
  "he divorced",
  "she divorced",
  "inheritance",
  "obligatory",
  "recommended",
  "makruh",
  "it is lawful",
  "it is unlawful",
  "the divorce",
  "iddah",
  "dower",
  "dowry",
  "guardianship",
  "witnesses",
  "contract",
  "expiation",
  "kafaarah",
  "retaliation",
  "qisas",
];

function hasDuaSignal(content: string): boolean {
  const lower = content.toLowerCase().trim();
  if (DUA_OPENINGS.some((o) => lower.startsWith(o) || lower.includes(" " + o))) return true;
  if (SUPPLICATION_PHRASES.some((p) => lower.includes(p))) return true;
  return false;
}

function hasJurisprudenceSignal(content: string): boolean {
  const lower = content.toLowerCase();
  return JURISPRUDENCE_PHRASES.some((p) => lower.includes(p));
}

function isShortNarratorOnly(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length > 120) return false;
  return !hasDuaSignal(trimmed);
}

export type MatchRow = {
  id: string;
  content: string;
  metadata?: { type?: string; edition?: string; reference?: string; surah?: string; context?: string };
  similarity?: number;
};

/**
 * Re-rank matches so du'a/supplication content ranks higher and jurisprudence/narrative content lower.
 * Curated entries (metadata.context) get a small boost.
 */
export function reRankForDuaIntent(matches: MatchRow[]): MatchRow[] {
  return matches.map((m) => {
    let sim = Math.max(0, Math.min(1, m.similarity ?? 0));
    let multiplier = 1;

    if (m.metadata?.context) multiplier *= CURATED_BOOST;
    if (hasDuaSignal(m.content)) multiplier *= BOOST_MULTIPLIER;
    if (hasJurisprudenceSignal(m.content)) multiplier *= PENALTY_MULTIPLIER;
    if (isShortNarratorOnly(m.content)) multiplier *= PENALTY_MULTIPLIER;

    sim = Math.min(1, sim * multiplier);

    return { ...m, similarity: sim };
  });
}
