# Data sources & licensing (DuaOS)

DuaOS uses the following data for semantic search. Each source has different license terms.

## Quran (full, chunked)

- **Source:** [risan/quran-json](https://github.com/risan/quran-json) (Arabic text).
- **License:** [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Use in DuaOS:** Yes. You may use, display, and create derivative works (e.g. chunking, embedding) for du'a and search. You must:
  - Give **appropriate credit** (e.g. “Quran text from risan/quran-json, CC-BY-SA 4.0”).
  - **Share-alike:** If you distribute an adaptation of the dataset itself, it must be under CC-BY-SA 4.0. Your app code can stay under its own license; the obligation applies to the Quran data/adaptations you redistribute.
- **Attribution:** Add a short credit in your app or README (e.g. on the “Verified sources” or about screen).

## Hadith (full, chunked – Sahih Bukhari)

- **Source:** [4thel00z/hadith.json](https://github.com/4thel00z/hadith.json) (scraped from [sunnah.com](https://sunnah.com)).
- **License:** **GPL-3**.
- **Use in DuaOS:** You can **use** the data (download, chunk, embed, serve search results) for du'a purposes. GPL-3 allows use and modification. If you **distribute** a work that contains or is based on this hadith dataset, the GPL-3 terms apply to that work (e.g. providing source, same license for derivatives). Using it only on your own server without distributing the dataset or a GPL-derived “program” is often considered internal use. **To be safe:** if DuaOS is open source, keeping the repo under GPL-3 or adding a clear notice that hadith data is from a GPL source is one way to stay aligned; if you need to keep DuaOS under a different license, consider using only the **curated** `scripts/hadiths.json` (your own content) and not the full downloaded Bukhari dataset, or seek legal advice.

## Curated data (no third‑party license)

- **Names of Allah:** `scripts/names-of-allah.json` — project’s own data.
- **Curated hadith:** `scripts/hadiths.json` — project’s own curated du'a hadiths.
- **Curated Quran du'as:** `scripts/quran-duas.json` — project’s own curated verses.

These are fully fine to use for DuaOS in any way.

## Summary

| Data              | Source              | License   | Use for DuaOS du'a / search      |
|-------------------|---------------------|-----------|-----------------------------------|
| Full Quran        | risan/quran-json    | CC-BY-SA 4.0 | Yes, with attribution and share-alike for distributed adaptations of the data. |
| Full Hadith       | 4thel00z/hadith.json| GPL-3     | Yes for use; distribution of the data or derived works is under GPL-3. Prefer curated hadith if you need to avoid GPL. |
| Curated hadith/Quran | This repo        | —         | Yes, no third-party license.     |

**Bottom line:** The data is **able to be used for DuaOS** (du'a and search). For Quran, add attribution and respect CC-BY-SA 4.0 when redistributing the data. For full hadith, either comply with GPL-3 when distributing or rely on the curated hadith only.
