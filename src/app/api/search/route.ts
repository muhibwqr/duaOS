import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { searchBodySchema, HADITH_EDITIONS } from "@/lib/validation";
import { rateLimitSearch } from "@/lib/rate-limit";

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
    const { query, edition } = parsed.data;
    const editionStr = String(edition ?? "");
    const preferredEdition =
      editionStr.length > 0 && HADITH_EDITIONS.includes(editionStr as (typeof HADITH_EDITIONS)[number])
        ? (editionStr as (typeof HADITH_EDITIONS)[number])
        : undefined;

    const openai = new OpenAI({ apiKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      data: [embeddingData],
    } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingData.embedding;

    const { data: matches, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: preferredEdition ? 20 : 10,
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

    const names = (matches ?? []).filter(
      (m: { metadata?: { type?: string } }) => m.metadata?.type === "name"
    );
    let hadiths = (matches ?? []).filter(
      (m: { metadata?: { type?: string } }) => m.metadata?.type === "hadith"
    );
    if (preferredEdition) {
      hadiths = hadiths.filter(
        (m: { metadata?: { edition?: string } }) => m.metadata?.edition === preferredEdition
      );
    }

    return NextResponse.json({
      name: names[0] ?? null,
      hadith: hadiths[0] ?? names[0] ?? null,
      matches: matches ?? [],
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
