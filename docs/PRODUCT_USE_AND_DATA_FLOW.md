# DuaOS — Product Use and Data Flow

This document defines every step of product use, all data files with exact data extracted, and every point where an LLM/API is called. Use it to feed a model for refinements.

---

## 1. Data files (source of truth)

### 1.1 Runtime / app data (bundled or loaded in app)

| File | Location | What is extracted / used |
|------|----------|---------------------------|
| **names-of-allah.json** | `src/data/names-of-allah.json` | Array of `{ arabic, english, meaning, tags: string[] }`. Used by: (1) home page for **local match** — tokenize query, score against each name’s `english`, `meaning`, `tags`; (2) `src/data/names-context.ts` to build **pre-computed string** for refine (see below). |
| **names-context.ts** | `src/data/names-context.ts` | Imports `names-of-allah.json`; at **module load** builds one string: `"All 99 Names of Allah (choose the most relevant for this intention): " + names.map(n => \`${n.english} (${n.meaning})\`).join(", ")`. Exported as `NAMES_OF_ALLAH_REFINE_CONTEXT`. **No per-request parsing.** |

### 1.2 Seed / build-time data (scripts and generated)

| File | Location | What is extracted / used |
|------|----------|---------------------------|
| **names-of-allah.json** | `scripts/names-of-allah.json` | Same shape as `src/data/names-of-allah.json`. **Seed script** reads it: for each entry, embedding text = `[english, meaning, arabic, ...tags].join(" ")`; content stored = `"${english} (${meaning}) - ${arabic}"`; metadata = `{ type: "name", tags }`. Inserted into Supabase `spiritual_assets` with embedding from OpenAI. |
| **hadiths.json** | `scripts/hadiths.json` | Curated hadith list. **Seed** uses only if `scripts/data/hadith-chunks.json` does **not** exist. Each entry: `{ content, reference, edition, tags? }`. Embedding text = `[content, reference, ...tags].join(" ")`; stored as `content`; metadata = `{ type: "hadith", edition, reference, tags? }`. |
| **quran-duas.json** | `scripts/quran-duas.json` | Curated Quran verses. **Seed** uses only if `scripts/data/quran-chunks.json` does **not** exist. Each entry: `{ arabic, english, reference, surah, tags }`. Embedding text = `[english, arabic, surah, ...tags].join(" ")`; content = `"${english} — ${arabic}"`; metadata = `{ type: "quran", reference, surah, tags }`. |
| **quran.json** (raw) | `scripts/data/raw/quran.json` | From risan/quran-json. **download-data.ts** fetches and writes. **chunk-data.ts** reads: keyed by surah number; each value = array of `{ chapter, verse, text }`. Extracted: one chunk per verse → `content` = verse text, `reference` = "surah:verse", `surah`, `verse`, `surahName`. |
| **hadith-bukhari/*.json** | `scripts/data/raw/hadith-bukhari/bukhari_1.json` … `bukhari_97.json` | From 4thel00z/hadith.json. **download-data.ts** fetches. **chunk-data.ts** reads each file: array of `{ reference?, arabic?, english? }`. Extracted: one chunk per hadith (or split by sentences if >6000 chars); `content` = english/arabic text; `reference` = normalized short ref (e.g. "Book 1, Hadith 1"); `edition` = "eng-bukhari". |
| **quran-chunks.json** | `scripts/data/quran-chunks.json` | **Output of chunk-data.ts.** Array of `{ content, reference, surah, verse, surahName }`. **Seed** uses if present: embedding text = `[content, reference, surahName].join(" ")`; metadata = `{ type: "quran", reference, surah: surahName, verse }`. |
| **hadith-chunks.json** | `scripts/data/hadith-chunks.json` | **Output of chunk-data.ts.** Array of `{ content, reference, edition }`. **Seed** uses if present: embedding text = `[content, reference].join(" ")`; metadata = `{ type: "hadith", edition, reference }`. |

### 1.3 Client-only storage (no file on disk in repo)

| Source | Key | What is stored / read |
|--------|-----|------------------------|
| **localStorage** | `duaos-ledger` | Array of `{ dua, name?, at }`. Personal Ledger: refined du'as user saved. |
| **localStorage** | `duaos-cache` | Array of `{ id, dua, nameOfAllah?, hadithSnippet?, addedAt }`. Du'a reminders (cart). Max 50 items. |
| **localStorage** | `duaos-input-mode` | `"voice"` or `"text"`. |
| **localStorage** | `duaos-hadith-edition` | Hadith edition filter (e.g. `eng-bukhari` or `""`). |

---

## 2. Database (Supabase)

- **Table:** `spiritual_assets` — columns: `id`, `content`, `metadata` (JSONB), `embedding` (vector(1536)), `created_at`.
- **RPC:** `match_documents(query_embedding, match_threshold, match_count, filter_metadata)` — returns rows ordered by cosine similarity, with `id`, `content`, `metadata`, `similarity`. Used only at **request time** (search API).

---

## 3. Step-by-step product use

### 3.1 User opens the app (home page)

1. **Load:** Page reads `localStorage` for `duaos-ledger`, `duaos-cache`, `duaos-input-mode`, `duaos-hadith-edition`.
2. **Static UI:** Intent selector (Problem / Refine / Goal), input or mic, suggestion pills (no API), hadith edition dropdown (labels from `src/lib/validation.ts` — `HADITH_EDITION_LABELS`).
3. **No LLM call.**

---

### 3.2 User enters text and submits (or clicks a suggestion pill)

1. **Input:** Query = trimmed text from input (or pill), max length 2000 (from `MAX_QUERY_LENGTH` in validation).
2. **Local match (no API):**  
   - **Data:** `src/data/names-of-allah.json` (imported as `namesOfAllah`).  
   - **Logic:** `localMatch(query, namesOfAllah)` in `src/lib/local-match.ts`: tokenize query (remove stop words, split), for each name score by matches in `english`, `meaning`, `tags`; if best score > 0 return `{ name: { id, content, metadata }, hadith: null, quran: null }`.  
   - If **local match returns non-null:** set search result from it (name only; no hadith/quran), **no API call**, done.
3. **If local match is null:** call **Search API** (see § 4.1). Response: `{ name, hadith, hadiths, quran, matches }`. Frontend sets `searchResult` from that.
4. **LLM:** Not used on the home page for this step; LLM is used **inside the Search API** (embedding + optional name fallback).

---

### 3.3 User uses voice (mic) instead of text

1. **Start:** User clicks mic; app requests microphone; starts `MediaRecorder` (WebM/opus).
2. **Stop:** User stops; app builds a `Blob` from chunks and sends it to **Transcribe API** (see § 4.3).
3. **Transcribe API:** **LLM/API call — OpenAI Whisper.** Input: audio file; optional `language` (e.g. `ar` from Arabic toggle). Output: `{ text }`.
4. **After response:** App sets `query` to `transcription.text` and can auto-run search (e.g. `handleSearch(transcription.text)` if desired) or user submits. So after voice: same flow as § 3.2 with that query.

---

### 3.4 After search: “From search” block and Refine

1. **Display:** Show `searchResult.name`, `searchResult.hadiths` (first 3 full; rest as “Also relevant: Ref, Ref…”), `searchResult.quran` (one verse). All from API or local match.
2. **Refine into du'a:** User clicks “Refine into du'a”.
   - **Data prepared on client:**  
     - `nameContent` = `searchResult.name.content` (sliced to 2000).  
     - `hadiths` = `searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])`.  
     - `hadithContent` = `buildHadithContext(hadiths)` — first 3 hadith full text + `[Ref]`, then “Also relevant (by relevance): Ref, Ref…”, total length capped at 5000.  
     - `quranContent` = `searchResult.quran.content` (sliced to 2000).  
   - **Request body:** `{ userInput, nameOfAllah: nameContent || undefined, hadith: hadithContent || undefined, quran: quranContent || undefined }` (userInput = query or refined du'a text, max 5000).
3. **Refine API** (see § 4.2): **LLM call — OpenAI gpt-4o-mini** via Mastra agent. Receives the base DuaOS system prompt + a structured `CURRENT SPIRITUAL CONTEXT` block (name/hadith/quran, or 99-name fallback when missing) and a labeled user message `USER INTENTION: "..."`. Returns streamed text → shown as “Refined du'a”.

---

### 3.5 After refine: Save, cache, share

1. **Save to Ledger:** Appends `{ dua, name: searchResult?.name?.content, at }` to `localStorage` `duaos-ledger`. No API, no LLM.
2. **Add to cache:** Appends to `duaos-cache` with `dua`, `nameOfAllah`, `hadithSnippet: searchResult?.hadith?.content`. No API, no LLM.
3. **Share (image):** User clicks Share → intention step → “Continue” → **PNG generation:** `html-to-image` `toPng(shareCardRef.current)` (no LLM). Then options: Twitter (text only, no API), Instagram = download PNG, Message = Web Share API or clipboard, Download = same PNG. No LLM.
4. **Share list (cart):** “Share list” builds text from cache + ledger and uses `navigator.share` or clipboard. No LLM.

---

### 3.6 Cart / Ledger panel

- **Open:** Slide-out from header; reads same `localStorage` keys.  
- **Copy / Save to Ledger / Remove:** All local state and `localStorage` only. No API, no LLM.

---

## 4. API routes (when the LLM is called)

### 4.1 POST /api/search

**When:** User submits a search and local match returned null.

**Input (body):** `{ query (required, 1–2000 chars), intent?, edition? }`. Validated with `searchBodySchema`.

**Data used (no file read at request time):**  
- Query string only.  
- Supabase: table `spiritual_assets` via RPC `match_documents`.

**LLM call 1 — OpenAI Embeddings:**  
- **When:** Always, at start of handler (after validation and env check).  
- **Model:** `text-embedding-3-small`.  
- **Input:** single string = `query`.  
- **Output:** `queryEmbedding` (vector of 1536 dimensions).

**DB:**  
- `match_documents(query_embedding, 0.3, 25, {})` → `matches`.  
- Split by `metadata.type` into `names`, `hadiths`, `quranVerses`; optionally filter hadiths by `edition`.  
- If `names.length === 0`: **second RPC** `match_documents(query_embedding, 0, 1, { type: "name" })` → use first result as `nameResult`.  
- **No second LLM call** for the name fallback (reuses same `queryEmbedding`).

**Response:** `{ name, hadith: hadiths[0], hadiths, quran: quranVerses[0], matches }`.

---

### 4.2 POST /api/refine

**When:** User clicks “Refine into du'a” after search.

**Input (body):** `{ userInput (required, 1–5000), nameOfAllah?, hadith?, quran? }`. Validated with `refineBodySchema` (hadith max 5000, others 2000).

**Data used at request time:**  
- **Pre-computed (no per-request parsing):**  
  - `NAMES_OF_ALLAH_REFINE_CONTEXT` from `src/data/names-context.ts` (built at module load from `src/data/names-of-allah.json`)  
  - `DUAOS_AGENT_BASE_PROMPT` from `src/mastra/agents/dua-agent.ts`
- **From request body only:** `userInput`, `nameOfAllah`, `hadith`, `quran`.

**LLM call — OpenAI Chat (Mastra agent):**  
- **When:** After validation.  
- **Model:** `openai/gpt-4o-mini` (via Mastra).  
- **Input construction:**  
  - System/instructions (`fullSystemMessage`):  
    1. `DUAOS_AGENT_BASE_PROMPT`  
    2. `CURRENT SPIRITUAL CONTEXT:` block with lines for any provided values:
       - `- Name of Allah: ...`
       - `- Quranic Verse: ...`
       - `- Relevant Hadith: ...`
       - If none are provided, include fallback text + `NAMES_OF_ALLAH_REFINE_CONTEXT` so one relevant Name can still be selected.
  - User message: `USER INTENTION: "..."` (input trimmed and quotes normalized).
- **Output:** Streamed text (refined du'a).
- **Agent instructions** (in `src/mastra/agents/dua-agent.ts`): spiritual role + source-of-truth grounding + Arabic-first output + safety constraints.

**Response:** Streaming text/plain body (refined du'a).

---

### 4.3 POST /api/transcribe

**When:** User records voice and stops; app sends the audio file.

**Input:** `FormData` with `file` or `audio` (Blob), optional `language` (e.g. `ar`). Max file size 25 MB; allowed types WebM, MP3, MP4, WAV, OGG, etc.

**Data used:** Only the uploaded audio blob and `language`. No app data files.

**LLM/API call — OpenAI Whisper:**  
- **When:** After rate limit and file validation.  
- **Model:** `whisper-1`.  
- **Input:** audio file; optional `language`.  
- **Output:** `{ text }` — transcription.

**Response:** `{ text: string }`.

---

## 5. Summary: when the LLM is called

| Step | API / action | LLM / API | Model | Input |
|------|----------------|-----------|--------|--------|
| Search (when local match fails) | POST /api/search | OpenAI | text-embedding-3-small | User `query` (single string) |
| Refine | POST /api/refine | OpenAI (Mastra) | gpt-4o-mini | `DUAOS_AGENT_BASE_PROMPT` + structured `CURRENT SPIRITUAL CONTEXT` (with 99-name fallback when empty) + labeled `USER INTENTION: "..."` |
| Voice | POST /api/transcribe | OpenAI | whisper-1 | Audio file + optional `language` |

**No LLM** for: local match, Ledger/cache, share image generation, share list, hadith edition filter, or any static UI.

---

## 6. Build / seed pipeline (offline, not prod request path)

1. **download-data.ts:** Fetches `scripts/data/raw/quran.json` and `scripts/data/raw/hadith-bukhari/*.json`. No LLM.
2. **chunk-data.ts:** Reads raw files; writes `scripts/data/quran-chunks.json` and `scripts/data/hadith-chunks.json`. No LLM.
3. **seed-spiritual-assets.ts:**  
   - Clears `spiritual_assets`.  
   - Reads `scripts/names-of-allah.json` (and optionally `hadith-chunks.json`, `quran-chunks.json`, or else `scripts/hadiths.json`, `scripts/quran-duas.json`).  
   - Index completeness rule: **all Quran ayas + full downloaded Bukhari** are indexed only when chunk files exist before seeding; otherwise only curated subsets are indexed.
   - **LLM — OpenAI Embeddings:** `text-embedding-3-small` in batches of 25 for every name, hadith, and Quran chunk.  
   - Inserts rows into Supabase with `content`, `metadata`, `embedding`.  
   - No chat/Whisper; only embeddings.

---

## 7. Validation and limits (reference)

- **Search:** `query` 1–2000 chars; `edition` optional, from `HADITH_EDITIONS`.  
- **Refine:** `userInput` 1–5000; `nameOfAllah` 0–2000; `hadith` 0–5000; `quran` 0–2000.  
- **Transcribe:** File ≤ 25 MB; allowed audio MIME types.  
- **Rate limits (in-memory):** Search 20/min, Refine 10/min, Transcribe 15/min per IP.

This document is the single reference for product steps, data files and extracted fields, and every LLM/API call.
