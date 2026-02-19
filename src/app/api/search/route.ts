import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { searchBodySchema, HADITH_EDITIONS } from "@/lib/validation";
import { rateLimitSearch } from "@/lib/rate-limit";
import { enrichQuery } from "@/lib/query-enrichment";
import { reRankForDuaIntent, type MatchRow } from "@/lib/rerank-dua-intent";
import { selectRelevantDuas, applySelectedIds } from "@/lib/llm-select-dua";

export async function POST(req: Request) {
  try {
    const rate = rateLimitSearch(req);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: rate.retryAfter },
        { status: 429, headers: rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : undefined }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!apiKey || !supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Service unavailable. Check OPENAI_API_KEY, SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = searchBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { query, edition, intent, llm_filter } = parsed.data;
    const trimmedQuery = query.trim();
    const editionStr = String(edition ?? "");
    const preferredEdition =
      editionStr.length > 0 && HADITH_EDITIONS.includes(editionStr as (typeof HADITH_EDITIONS)[number])
        ? (editionStr as (typeof HADITH_EDITIONS)[number])
        : undefined;

    const openai = new OpenAI({ apiKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

    const enrichedQuery = enrichQuery(query);
    const {
      data: [embeddingData],
    } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: enrichedQuery,
    });
    const queryEmbedding = embeddingData.embedding;
    const minSimilarity = 0.35;
    const dynamicThreshold = trimmedQuery.length > 30 ? 0.3 : Math.max(0.3, 0.4 - trimmedQuery.length / 200);
    const matchCount = 25;

    const { data: matches, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: dynamicThreshold,
      match_count: matchCount,
      filter_metadata: {},
    });

    if (error) {
      console.error("match_documents error:", error);
      const hint =
        error.code === "PGRST202" || error.message?.includes("function")
          ? " Run the SQL in supabase/schema.sql in the Supabase SQL Editor, then run: npm run seed"
          : "";
      return NextResponse.json(
        { error: `Search failed.${hint}` },
        { status: 500 }
      );
    }

    const raw = (matches ?? []) as MatchRow[];
    const withIntentScores = reRankForDuaIntent(raw);
    const reranked = [...withIntentScores]
      .filter((m) => (m.similarity ?? 0) >= minSimilarity)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    const names = reranked.filter((m) => m.metadata?.type === "name");
    let hadiths = reranked.filter((m) => m.metadata?.type === "hadith");
    if (preferredEdition) {
      hadiths = hadiths.filter((m) => m.metadata?.edition === preferredEdition);
    }
    let quranVerses = reranked.filter((m) => m.metadata?.type === "quran");

    const hasHadithSource = (m: MatchRow) => typeof m.metadata?.reference === "string" && m.metadata.reference.trim() !== "" || typeof m.metadata?.edition === "string";
    const hasQuranSource = (m: MatchRow) => typeof m.metadata?.reference === "string" && m.metadata.reference.trim() !== "" || typeof m.metadata?.surah === "string";
    hadiths = hadiths.filter(hasHadithSource);
    quranVerses = quranVerses.filter(hasQuranSource);

    const needName = names.length === 0;
    const needHadith = hadiths.length === 0;
    const needQuran = quranVerses.length === 0;

    const fallbackBase = { query_embedding: queryEmbedding };
    const [nameFallbackRes, hadithFallbackRes, quranFallbackRes] = await Promise.all([
      needName
        ? supabase.rpc("match_documents", {
            ...fallbackBase,
            match_threshold: 0,
            match_count: 1,
            filter_metadata: { type: "name" },
          })
        : Promise.resolve({ data: [] }),
      needHadith
        ? supabase.rpc("match_documents", {
            ...fallbackBase,
            match_threshold: 0,
            match_count: 10,
            filter_metadata: preferredEdition ? { type: "hadith", edition: preferredEdition } : { type: "hadith" },
          })
        : Promise.resolve({ data: [] }),
      needQuran
        ? supabase.rpc("match_documents", {
            ...fallbackBase,
            match_threshold: 0,
            match_count: 5,
            filter_metadata: { type: "quran" },
          })
        : Promise.resolve({ data: [] }),
    ]);

    let nameResult = names[0] ?? (nameFallbackRes.data ?? [])[0] ?? null;
    if (needHadith) {
      const fallback = (hadithFallbackRes.data ?? []) as MatchRow[];
      hadiths = fallback.filter(hasHadithSource);
    }
    if (needQuran) {
      const fallback = (quranFallbackRes.data ?? []) as MatchRow[];
      quranVerses = fallback.filter(hasQuranSource);
    }

    if (intent === "goal" && nameResult && hadiths.length > 1) {
      hadiths = [...hadiths].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    }
    if (intent === "problem" && hadiths.length > 1) {
      hadiths = [...hadiths].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    }

    const hadithSlice = hadiths.slice(0, 8);
    const quranSlice = quranVerses.slice(0, 6);
    const selected = await selectRelevantDuas(trimmedQuery, hadithSlice, quranSlice, {
      apiKey,
      skip: !llm_filter,
    });
    const { hadiths: hadithsFiltered, quranVerses: quranFiltered } = applySelectedIds(
      hadiths,
      quranVerses,
      selected
    );
    hadiths = hadithsFiltered;
    quranVerses = quranFiltered;

    return NextResponse.json({
      name: nameResult,
      hadith: hadiths[0] ?? null,
      hadiths: hadiths,
      quran: quranVerses[0] ?? null,
      quranVerses: quranVerses,
      matches: reranked,
      intent: intent ?? undefined,
    });
  } catch (e: unknown) {
    console.error("Search error:", e);
    let message = "Search failed.";
    if (e && typeof e === "object" && "status" in e) {
      const status = (e as { status?: number }).status;
      if (status === 401) message = "Invalid OpenAI API key. Check OPENAI_API_KEY in .env (or .env.local).";
      else if (status === 429) message = "OpenAI rate limit. Try again in a moment.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
