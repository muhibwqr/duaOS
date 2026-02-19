/**
 * Chunk downloaded Quran and Hadith for embedding.
 * - Quran: one chunk per verse for precise citation (e.g. 2:286).
 * - Hadith: one chunk per hadith across ALL English editions.
 *
 * Supports two hadith source formats:
 *   1. fawazahmed0/hadith-api: { metadata, hadiths: [{ hadithnumber, text, ... }] }
 *   2. Legacy 4thel00z/hadith.json: [{ reference, english, arabic }] per book file
 *
 * Run after: npx tsx scripts/download-data.ts
 * Then: npx tsx scripts/chunk-data.ts
 *
 * Output: scripts/data/quran-chunks.json, scripts/data/hadith-chunks.json
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(process.cwd(), "scripts/data");
const RAW_DIR = resolve(DATA_DIR, "raw");

const HADITH_MAX_CHARS = 6000;

type QuranVerse = { chapter: number; verse: number; text: string };
type QuranRaw = Record<string, QuranVerse[]>;

export type QuranChunk = {
  content: string;
  reference: string;
  surah: number;
  verse: number;
  surahName: string;
};

export type HadithChunk = {
  content: string;
  reference: string;
  edition: string;
};

const BOOK_LABELS: Record<string, string> = {
  "eng-bukhari":  "Sahih Bukhari",
  "eng-muslim":   "Sahih Muslim",
  "eng-abudawud": "Sunan Abu Dawud",
  "eng-tirmidhi": "Jami At Tirmidhi",
  "eng-nasai":    "Sunan an-Nasai",
  "eng-ibnmajah": "Sunan Ibn Majah",
  "eng-malik":    "Muwatta Malik",
  "eng-nawawi":   "Forty Hadith Nawawi",
  "eng-qudsi":    "Forty Hadith Qudsi",
  "eng-dehlawi":  "Forty Hadith Dehlawi",
};

const SURAH_NAMES: Record<number, string> = {
  1: "Al-Fatihah", 2: "Al-Baqarah", 3: "Aal-Imran", 4: "An-Nisa", 5: "Al-Maidah",
  6: "Al-An'am", 7: "Al-A'raf", 8: "Al-Anfal", 9: "At-Tawbah", 10: "Yunus",
  11: "Hud", 12: "Yusuf", 13: "Ar-Ra'd", 14: "Ibrahim", 15: "Al-Hijr",
  16: "An-Nahl", 17: "Al-Isra", 18: "Al-Kahf", 19: "Maryam", 20: "Ta-Ha",
  21: "Al-Anbiya", 22: "Al-Hajj", 23: "Al-Mu'minun", 24: "An-Nur", 25: "Al-Furqan",
  26: "Ash-Shu'ara", 27: "An-Naml", 28: "Al-Qasas", 29: "Al-Ankabut", 30: "Ar-Rum",
  31: "Luqman", 32: "As-Sajda", 33: "Al-Ahzab", 34: "Saba", 35: "Fatir",
  36: "Ya-Sin", 37: "As-Saffat", 38: "Sad", 39: "Az-Zumar", 40: "Ghafir",
  41: "Fussilat", 42: "Ash-Shura", 43: "Az-Zukhruf", 44: "Ad-Dukhan", 45: "Al-Jathiya",
  46: "Al-Ahqaf", 47: "Muhammad", 48: "Al-Fath", 49: "Al-Hujurat", 50: "Qaf",
  51: "Adh-Dhariyat", 52: "At-Tur", 53: "An-Najm", 54: "Al-Qamar", 55: "Ar-Rahman",
  56: "Al-Waqi'ah", 57: "Al-Hadid", 58: "Al-Mujadila", 59: "Al-Hashr", 60: "Al-Mumtahanah",
  61: "As-Saf", 62: "Al-Jumu'ah", 63: "Al-Munafiqun", 64: "At-Taghabun", 65: "At-Talaq",
  66: "At-Tahrim", 67: "Al-Mulk", 68: "Al-Qalam", 69: "Al-Haqqah", 70: "Al-Ma'arij",
  71: "Nuh", 72: "Al-Jinn", 73: "Al-Muzzammil", 74: "Al-Muddaththir", 75: "Al-Qiyamah",
  76: "Al-Insan", 77: "Al-Mursalat", 78: "An-Naba", 79: "An-Nazi'at", 80: "Abasa",
  81: "At-Takwir", 82: "Al-Infitar", 83: "Al-Mutaffifin", 84: "Al-Inshiqaq", 85: "Al-Buruj",
  86: "At-Tariq", 87: "Al-A'la", 88: "Al-Ghashiya", 89: "Al-Fajr", 90: "Al-Balad",
  91: "Ash-Shams", 92: "Al-Layl", 93: "Ad-Duha", 94: "Ash-Sharh", 95: "At-Tin",
  96: "Al-Alaq", 97: "Al-Qadr", 98: "Al-Bayyinah", 99: "Az-Zalzalah", 100: "Al-Adiyat",
  101: "Al-Qari'ah", 102: "At-Takathur", 103: "Al-Asr", 104: "Al-Humazah", 105: "Al-Fil",
  106: "Quraysh", 107: "Al-Ma'un", 108: "Al-Kawthar", 109: "Al-Kafirun", 110: "An-Nasr",
  111: "Al-Masad", 112: "Al-Ikhlas", 113: "Al-Falaq", 114: "An-Nas",
};

function chunkQuran(): QuranChunk[] {
  const path = resolve(RAW_DIR, "quran.json");
  if (!existsSync(path)) {
    console.warn("  quran.json not found, skipping Quran chunks.");
    return [];
  }
  const raw: QuranRaw = JSON.parse(readFileSync(path, "utf-8"));
  const chunks: QuranChunk[] = [];

  for (let surahNum = 1; surahNum <= 114; surahNum++) {
    const key = String(surahNum);
    const verses = raw[key];
    if (!verses || !Array.isArray(verses)) continue;

    const surahName = SURAH_NAMES[surahNum] ?? `Surah ${surahNum}`;
    for (const v of verses) {
      const text = (v.text || "").trim();
      if (!text) continue;
      chunks.push({
        content: text,
        reference: `${surahNum}:${v.verse}`,
        surah: surahNum,
        verse: v.verse,
        surahName,
      });
    }
  }
  return chunks;
}

function splitLongText(text: string, reference: string, edition: string): HadithChunk[] {
  if (text.length <= HADITH_MAX_CHARS) {
    return [{ content: text, reference, edition }];
  }
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: HadithChunk[] = [];
  let acc = "";
  for (const s of sentences) {
    if (acc.length + s.length > HADITH_MAX_CHARS && acc.length > 0) {
      chunks.push({ content: acc.trim(), reference, edition });
      acc = "";
    }
    acc += s;
  }
  if (acc.trim()) chunks.push({ content: acc.trim(), reference, edition });
  return chunks;
}

/**
 * Parse fawazahmed0/hadith-api format:
 * { metadata: {...}, hadiths: [{ hadithnumber, text, ... }] }
 * OR sections format:
 * { metadata: {...}, hadiths: [{ hadithnumber, text }] } with sections
 */
function chunkFawazEdition(editionId: string, filePath: string): HadithChunk[] {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  const label = BOOK_LABELS[editionId] ?? editionId;
  const chunks: HadithChunk[] = [];

  const hadiths: { hadithnumber?: number; text?: string }[] = raw.hadiths ?? [];

  for (const h of hadiths) {
    const text = (h.text || "").trim().replace(/\s+/g, " ");
    if (!text || text.length < 10) continue;

    const num = h.hadithnumber ?? 0;
    const reference = `${label} ${num}`;

    chunks.push(...splitLongText(text, reference, editionId));
  }

  return chunks;
}

/**
 * Legacy format: 4thel00z/hadith.json bukhari per-book files
 * [{ reference, english, arabic }]
 */
function chunkLegacyBukhari(): HadithChunk[] {
  const hadithDir = resolve(RAW_DIR, "hadith-bukhari");
  if (!existsSync(hadithDir)) return [];

  const chunks: HadithChunk[] = [];
  const files = readdirSync(hadithDir).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    const bookNum = parseInt(file.replace(/\D/g, ""), 10) || 0;
    const path = resolve(hadithDir, file);
    const arr: { reference?: string; english?: string; arabic?: string }[] = JSON.parse(readFileSync(path, "utf-8"));
    for (const h of arr) {
      const text = (h.english || h.arabic || "").trim().replace(/\s+/g, " ");
      if (!text) continue;
      const s = (h.reference || "").trim();
      const bookHadith = s.match(/Book\s*(\d+)\s*,\s*Hadith\s*(\d+)/i);
      let reference: string;
      if (bookHadith) reference = `Book ${bookHadith[1]}, Hadith ${bookHadith[2]}`;
      else {
        const num = s.match(/(\d+)/)?.[1];
        reference = num ? `${bookNum}:${num}` : s.slice(0, 80) || `Book ${bookNum}`;
      }

      chunks.push(...splitLongText(text, reference, "eng-bukhari"));
    }
  }
  return chunks;
}

function chunkAllHadith(): HadithChunk[] {
  const allChunks: HadithChunk[] = [];

  // New format: scripts/data/raw/hadith/*.json (fawazahmed0 API)
  const newHadithDir = resolve(RAW_DIR, "hadith");
  if (existsSync(newHadithDir)) {
    const files = readdirSync(newHadithDir).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      const editionId = file.replace(".json", "");
      const filePath = resolve(newHadithDir, file);
      console.log(`  Chunking ${BOOK_LABELS[editionId] ?? editionId}...`);
      const chunks = chunkFawazEdition(editionId, filePath);
      console.log(`    → ${chunks.length} chunks`);
      allChunks.push(...chunks);
    }
  }

  // If no new-format Bukhari was found, fall back to legacy per-book format
  const hasBukhari = allChunks.some((c) => c.edition === "eng-bukhari");
  if (!hasBukhari) {
    console.log("  Falling back to legacy Bukhari format...");
    const legacy = chunkLegacyBukhari();
    console.log(`    → ${legacy.length} chunks`);
    allChunks.push(...legacy);
  }

  return allChunks;
}

function main() {
  console.log("Chunking Quran (one verse per chunk for precise citation)...");
  const quranChunks = chunkQuran();
  console.log(`  Total: ${quranChunks.length} Quran chunks\n`);

  console.log("Chunking Hadith (all editions, one hadith per chunk)...");
  const hadithChunks = chunkAllHadith();
  console.log(`\n  Total: ${hadithChunks.length} Hadith chunks`);

  const editionCounts: Record<string, number> = {};
  for (const c of hadithChunks) {
    editionCounts[c.edition] = (editionCounts[c.edition] ?? 0) + 1;
  }
  console.log("\n  Breakdown:");
  for (const [ed, count] of Object.entries(editionCounts).sort()) {
    console.log(`    ${BOOK_LABELS[ed] ?? ed}: ${count}`);
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, "quran-chunks.json"), JSON.stringify(quranChunks, null, 0), "utf-8");
  writeFileSync(resolve(DATA_DIR, "hadith-chunks.json"), JSON.stringify(hadithChunks, null, 0), "utf-8");

  console.log("\nDone. Run: npm run seed");
}

main();
