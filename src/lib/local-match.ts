/**
 * Local matching: score query against 99 Names (english, meaning, tags).
 * No API call. Returns best Name or null if score is 0.
 */

export type NameEntry = { arabic: string; english: string; meaning: string; tags: string[] };

export type LocalMatchResult = {
  name: { id: string; content: string; metadata: Record<string, unknown> };
  hadith: null;
  quran?: null;
};

const STOP_WORDS = new Set([
  "a", "an", "the", "i", "me", "my", "we", "our", "you", "your", "it", "its",
  "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "can", "to", "for", "of", "in", "on", "at", "by", "with", "from", "and", "or", "but",
]);

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

export function localMatch(query: string, names: NameEntry[]): LocalMatchResult | null {
  const terms = tokenize(query);
  if (terms.length === 0) return null;

  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < names.length; i++) {
    const { english, meaning, tags } = names[i];
    const searchable = [
      english.toLowerCase(),
      meaning.toLowerCase(),
      ...tags.map((t) => t.toLowerCase()),
    ].join(" ");
    let score = 0;
    for (const term of terms) {
      if (searchable.includes(term)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex < 0 || bestScore === 0) return null;

  const name = names[bestIndex];
  const content = `${name.english} (${name.meaning}) - ${name.arabic}`;
  return {
    name: {
      id: `local-${bestIndex}`,
      content,
      metadata: { type: "name", tags: name.tags },
    },
    hadith: null,
    quran: null,
  };
}
