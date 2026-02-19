/**
 * Download full Quran and all major Hadith collections (English) from public APIs.
 * Run: npx tsx scripts/download-data.ts
 *
 * Sources:
 * - Quran (Arabic): https://github.com/risan/quran-json
 * - Hadith (all collections, English): https://github.com/fawazahmed0/hadith-api
 */

import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(process.cwd(), "scripts/data");
const RAW_DIR = resolve(DATA_DIR, "raw");
const QURAN_URL = "https://raw.githubusercontent.com/risan/quran-json/main/data/quran.json";

const HADITH_CDN_BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const HADITH_GITHUB_BASE = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions";

const ENGLISH_EDITIONS = [
  { id: "eng-bukhari",  label: "Sahih al-Bukhari" },
  { id: "eng-muslim",   label: "Sahih Muslim" },
  { id: "eng-abudawud", label: "Sunan Abu Dawud" },
  { id: "eng-tirmidhi", label: "Jami At Tirmidhi" },
  { id: "eng-nasai",    label: "Sunan an-Nasai" },
  { id: "eng-ibnmajah", label: "Sunan Ibn Majah" },
  { id: "eng-malik",    label: "Muwatta Malik" },
  { id: "eng-nawawi",   label: "Forty Hadith Nawawi" },
  { id: "eng-qudsi",    label: "Forty Hadith Qudsi" },
  { id: "eng-dehlawi",  label: "Forty Hadith Dehlawi" },
];

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

async function downloadWithFallback(edition: string): Promise<string> {
  const urls = [
    `${HADITH_CDN_BASE}/${edition}.min.json`,
    `${HADITH_CDN_BASE}/${edition}.json`,
    `${HADITH_GITHUB_BASE}/${edition}.min.json`,
    `${HADITH_GITHUB_BASE}/${edition}.json`,
  ];
  for (const url of urls) {
    try {
      return await download(url);
    } catch {
      continue;
    }
  }
  throw new Error(`All URLs failed for ${edition}`);
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  // --- Quran ---
  console.log("Downloading Quran (Arabic)...");
  const quranPath = resolve(RAW_DIR, "quran.json");
  if (existsSync(quranPath)) {
    console.log("  quran.json already exists, skip.");
  } else {
    const body = await download(QURAN_URL);
    await writeFile(quranPath, body, "utf-8");
    console.log("  Saved quran.json");
  }

  // --- Hadith collections ---
  const hadithDir = resolve(RAW_DIR, "hadith");
  await mkdir(hadithDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  for (const { id, label } of ENGLISH_EDITIONS) {
    const path = resolve(hadithDir, `${id}.json`);
    if (existsSync(path)) {
      console.log(`  ${label} (${id}) — already exists, skip.`);
      skipped++;
      continue;
    }
    console.log(`  Downloading ${label} (${id})...`);
    try {
      const body = await downloadWithFallback(id);
      await writeFile(path, body, "utf-8");
      downloaded++;
      console.log(`  ✓ ${label} saved.`);
    } catch (e) {
      console.error(`  ✗ Failed ${label}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nDone. Downloaded: ${downloaded}, Skipped (existing): ${skipped}`);
  console.log("Next: npx tsx scripts/chunk-data.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
