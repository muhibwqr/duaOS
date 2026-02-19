/**
 * Seed spiritual_assets with Names of Allah, hadiths, and Quran.
 * Uses full chunked data if present (scripts/data/quran-chunks.json, hadith-chunks.json),
 * otherwise uses curated scripts/quran-duas.json and scripts/hadiths.json.
 * Cleans data before embedding: removes junk, deduplicates, skips too-short entries.
 * Clears existing rows before seeding so every run embeds everything (no duplicates).
 * Run: npm run seed  (uses .env; or set env vars and npx tsx scripts/seed-spiritual-assets.ts)
 */
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiKey });
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = resolve(process.cwd(), "scripts/data");

type NameEntry = { arabic: string; english: string; meaning: string; tags: string[] };
type HadithEntry = { content: string; reference: string; edition: string; tags?: string[]; context?: string };
type QuranEntry = { arabic: string; english: string; reference: string; surah: string; tags: string[]; context?: string };
type QuranChunk = { content: string; reference: string; surah: number; verse: number; surahName: string };
type HadithChunk = { content: string; reference: string; edition: string };

const EMBED_BATCH_SIZE = 25;
const DB_INSERT_BATCH = 25;
const EMBED_RETRIES = 3;
const EMBED_RETRY_DELAY_MS = 2000;
const CLEAR_DELETE_BATCH = 500;

const JUNK_PATTERNS = [
  /^see (hadith|previous|above)/i,
  /^as above/i,
  /^\(another chain\)/i,
  /^narrated.*:?\s*as above\.?$/i,
  /^same narration/i,
  /^this hadith.*transmitted.*another chain/i,
  /^the above hadith.*narrated/i,
  /^\(same as /i,
  /^a similar hadith/i,
];
const MIN_HADITH_LENGTH = 40;

function isJunkHadith(content: string): boolean {
  const t = content.trim();
  if (t.length < MIN_HADITH_LENGTH) return true;
  return JUNK_PATTERNS.some((p) => p.test(t));
}

function deduplicateChunks(chunks: HadithChunk[]): HadithChunk[] {
  const seen = new Set<string>();
  const result: HadithChunk[] = [];
  for (const c of chunks) {
    const key = c.content.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; attempt <= EMBED_RETRIES; attempt++) {
    try {
      const { data } = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });
      return data.map((d) => d.embedding);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (isRetryable && attempt < EMBED_RETRIES) {
        const delay = EMBED_RETRY_DELAY_MS * attempt;
        console.warn(`  Embedding rate limit/error (${status}), retry ${attempt}/${EMBED_RETRIES} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("getEmbeddings failed after retries");
}

async function clearSpiritualAssets(): Promise<void> {
  let deleted = 0;
  while (true) {
    const { data: rows, error: selectError } = await supabase
      .from("spiritual_assets")
      .select("id")
      .limit(CLEAR_DELETE_BATCH);
    if (selectError) {
      console.error("Failed to fetch rows for clearing spiritual_assets:", selectError.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    const ids = rows
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string");
    if (ids.length === 0) break;

    const { error: deleteError } = await supabase
      .from("spiritual_assets")
      .delete()
      .in("id", ids);
    if (deleteError) {
      console.error("Failed to clear spiritual_assets:", deleteError.message);
      process.exit(1);
    }

    deleted += ids.length;
    if (deleted % 2000 === 0) {
      console.log(`  Cleared ${deleted} rows...`);
    }
  }
  console.log(`Cleared existing spiritual_assets (${deleted} rows).`);
}

type InsertRow = { content: string; metadata: Record<string, unknown>; embedding: number[] };

async function batchInsert(rows: InsertRow[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += DB_INSERT_BATCH) {
    const batch = rows.slice(i, i + DB_INSERT_BATCH);
    const { error } = await supabase.from("spiritual_assets").insert(batch);
    if (error) {
      console.error(`  Batch insert error at ${i}:`, error.message);
      for (const row of batch) {
        const { error: singleErr } = await supabase.from("spiritual_assets").insert(row);
        if (singleErr) console.error(`    Single insert error:`, singleErr.message);
        else inserted++;
      }
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

async function seedNames(): Promise<number> {
  const path = resolve(process.cwd(), "scripts/names-of-allah.json");
  const names: NameEntry[] = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`\n--- Seeding ${names.length} Names of Allah ---`);

  const allRows: InsertRow[] = [];
  for (let i = 0; i < names.length; i += EMBED_BATCH_SIZE) {
    const batch = names.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map(({ english, meaning, arabic, tags }) =>
      [english, meaning, arabic, ...(tags ?? [])].join(" ")
    );
    const embeddings = await getEmbeddings(texts);
    for (let j = 0; j < batch.length; j++) {
      const { arabic, english, meaning, tags } = batch[j];
      allRows.push({
        content: `${english} (${meaning}) - ${arabic}`,
        metadata: { type: "name", tags },
        embedding: embeddings[j],
      });
    }
    console.log(`  Embedded ${Math.min(i + EMBED_BATCH_SIZE, names.length)}/${names.length}`);
  }

  const inserted = await batchInsert(allRows);
  console.log(`  Inserted ${inserted}/${allRows.length} Names.`);
  return inserted;
}

async function seedHadiths(): Promise<number> {
  const chunkPath = resolve(DATA_DIR, "hadith-chunks.json");
  if (existsSync(chunkPath)) {
    const rawChunks: HadithChunk[] = JSON.parse(readFileSync(chunkPath, "utf-8"));
    const cleaned = rawChunks.filter((c) => !isJunkHadith(c.content));
    const chunks = deduplicateChunks(cleaned);

    const removed = rawChunks.length - chunks.length;
    console.log(`\n--- Seeding Hadith chunks ---`);
    console.log(`  Raw: ${rawChunks.length} → Cleaned: ${chunks.length} (removed ${removed} junk/dupes)`);

    const editionCounts: Record<string, number> = {};
    for (const c of chunks) editionCounts[c.edition] = (editionCounts[c.edition] ?? 0) + 1;
    for (const [ed, count] of Object.entries(editionCounts).sort()) console.log(`    ${ed}: ${count}`);

    const allRows: InsertRow[] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => `${c.reference} — ${c.content}`);
      const embeddings = await getEmbeddings(texts);
      for (let j = 0; j < batch.length; j++) {
        const { content, reference, edition } = batch[j];
        allRows.push({
          content,
          metadata: { type: "hadith", edition, reference },
          embedding: embeddings[j],
        });
      }
      if ((i + EMBED_BATCH_SIZE) % 500 < EMBED_BATCH_SIZE || i + EMBED_BATCH_SIZE >= chunks.length) {
        console.log(`  Embedded ${Math.min(i + EMBED_BATCH_SIZE, chunks.length)}/${chunks.length}`);
      }
    }

    console.log(`  Inserting ${allRows.length} rows into Supabase...`);
    const inserted = await batchInsert(allRows);
    console.log(`  Inserted ${inserted}/${allRows.length} Hadith.`);
    return inserted;
  }

  // Fallback: curated hadiths.json
  const path = resolve(process.cwd(), "scripts/hadiths.json");
  const hadiths: HadithEntry[] = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`\n--- Seeding ${hadiths.length} Hadiths (curated) ---`);

  const allRows: InsertRow[] = [];
  for (let i = 0; i < hadiths.length; i += EMBED_BATCH_SIZE) {
    const batch = hadiths.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map(({ content, reference, tags, context }) =>
      [context ?? "", content, reference, ...(tags ?? [])].filter(Boolean).join(" — ")
    );
    const embeddings = await getEmbeddings(texts);
    for (let j = 0; j < batch.length; j++) {
      const { content, reference, edition, tags, context } = batch[j];
      allRows.push({
        content,
        metadata: { type: "hadith", edition, reference, tags, ...(context ? { context } : {}) },
        embedding: embeddings[j],
      });
    }
    console.log(`  Embedded ${Math.min(i + EMBED_BATCH_SIZE, hadiths.length)}/${hadiths.length}`);
  }

  const inserted = await batchInsert(allRows);
  console.log(`  Inserted ${inserted}/${allRows.length} Hadith.`);
  return inserted;
}

async function seedQuran(): Promise<number> {
  const chunkPath = resolve(DATA_DIR, "quran-chunks.json");
  if (existsSync(chunkPath)) {
    const chunks: QuranChunk[] = JSON.parse(readFileSync(chunkPath, "utf-8"));
    console.log(`\n--- Seeding ${chunks.length} Quran chunks (full Quran) ---`);

    const allRows: InsertRow[] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => [c.content, c.reference, c.surahName].join(" "));
      const embeddings = await getEmbeddings(texts);
      for (let j = 0; j < batch.length; j++) {
        const { content, reference, surahName, verse } = batch[j];
        allRows.push({
          content,
          metadata: { type: "quran", reference, surah: surahName, verse },
          embedding: embeddings[j],
        });
      }
      if ((i + EMBED_BATCH_SIZE) % 500 < EMBED_BATCH_SIZE || i + EMBED_BATCH_SIZE >= chunks.length) {
        console.log(`  Embedded ${Math.min(i + EMBED_BATCH_SIZE, chunks.length)}/${chunks.length}`);
      }
    }

    console.log(`  Inserting ${allRows.length} rows into Supabase...`);
    const inserted = await batchInsert(allRows);
    console.log(`  Inserted ${inserted}/${allRows.length} Quran.`);
    return inserted;
  }

  // Fallback: curated quran-duas.json
  const path = resolve(process.cwd(), "scripts/quran-duas.json");
  const verses: QuranEntry[] = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`\n--- Seeding ${verses.length} Quran du'as (curated) ---`);

  const allRows: InsertRow[] = [];
  for (let i = 0; i < verses.length; i += EMBED_BATCH_SIZE) {
    const batch = verses.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map(({ english, arabic, surah, tags, context }) =>
      [context ?? "", english, arabic, surah, ...tags].filter(Boolean).join(" — ")
    );
    const embeddings = await getEmbeddings(texts);
    for (let j = 0; j < batch.length; j++) {
      const { arabic, english, reference, surah, tags } = batch[j];
      allRows.push({
        content: `${english} — ${arabic}`,
        metadata: { type: "quran", reference, surah, tags },
        embedding: embeddings[j],
      });
    }
    console.log(`  Embedded ${Math.min(i + EMBED_BATCH_SIZE, verses.length)}/${verses.length}`);
  }

  const inserted = await batchInsert(allRows);
  console.log(`  Inserted ${inserted}/${allRows.length} Quran.`);
  return inserted;
}

async function main() {
  const startTime = Date.now();
  console.log("Starting seed (clearing existing, then embedding everything)...\n");
  await clearSpiritualAssets();

  const nameCount = await seedNames();
  const hadithCount = await seedHadiths();
  const quranCount = await seedQuran();

  const total = nameCount + hadithCount + quranCount;
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log("\n--- Embedded summary ---");
  console.log(`  Names of Allah: ${nameCount}`);
  console.log(`  Hadith:         ${hadithCount}`);
  console.log(`  Quran:          ${quranCount}`);
  console.log(`  Total:          ${total}`);
  console.log(`  Time:           ${elapsed} minutes`);
  console.log("\nDone. All spiritual assets seeded.");
}

main();
