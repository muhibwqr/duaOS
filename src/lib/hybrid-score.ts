/**
 * Keyword-overlap score for hybrid (vector + lexical) ranking.
 * Returns 0–1: fraction of query terms that appear in the document.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "i", "me", "my", "we", "our", "you", "your", "it", "its",
  "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "can", "to", "for", "of", "in", "on", "at", "by", "with", "from", "and", "or", "but",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Returns a score in [0, 1]: proportion of query terms that appear in content.
 * Used to blend with vector similarity for hybrid ranking.
 */
export function keywordOverlapScore(query: string, content: string): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return 0;
  const contentLower = content.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) hits += 1;
  }
  return hits / queryTerms.length;
}

const DEFAULT_VECTOR_WEIGHT = 0.85;

/**
 * Blend vector similarity with keyword overlap: 0.85 * sim + 0.15 * keywordScore.
 * Keeps vector as primary; keyword boosts when user phrasing matches document.
 */
export function blendHybridScore(
  vectorSimilarity: number,
  keywordScore: number,
  vectorWeight: number = DEFAULT_VECTOR_WEIGHT
): number {
  return vectorWeight * vectorSimilarity + (1 - vectorWeight) * keywordScore;
}
