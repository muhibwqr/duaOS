import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { storeDuaBodySchema } from "@/lib/validation";
import { rateLimitDuas } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const rate = rateLimitDuas(req);
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
        {
          error:
            "Service unavailable. Check OPENAI_API_KEY, SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = storeDuaBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { content, nameOfAllah, hadithSnippet, intent } = parsed.data;

    const openai = new OpenAI({ apiKey });
    const {
      data: [embeddingData],
    } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const embedding = embeddingData.embedding;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Constrained ingest: content + keywords only; counter updated inside RPC
    const { data: rowId, error: rpcError } = await supabase.rpc("ingest_dua_event", {
      p_content: content,
      p_intent: intent ?? null,
      p_name_of_allah: nameOfAllah && nameOfAllah !== "" ? nameOfAllah : null,
      p_hadith_snippet: hadithSnippet && hadithSnippet !== "" ? hadithSnippet : null,
    });

    if (rpcError) {
      console.error("ingest_dua_event error:", rpcError);
      const hint =
        rpcError.code === "42883" || rpcError.message?.includes("function")
          ? " Run supabase/migrations/20250218000000_secure_counter_rls.sql in the Supabase SQL Editor."
          : "";
      return NextResponse.json({ error: `Failed to store du'a.${hint}` }, { status: 500 });
    }

    const id = rowId as string | null;
    if (!id) {
      return NextResponse.json({ error: "Failed to store du'a." }, { status: 500 });
    }

    // Optional: persist embedding for semantic match_duas (privileged update)
    await supabase.from("duas").update({ embedding }).eq("id", id);

    return NextResponse.json({ id }, { status: 201 });
  } catch (e: unknown) {
    console.error("Store du'a error:", e);
    let message = "Failed to store du'a.";
    if (e && typeof e === "object" && "status" in e) {
      const status = (e as { status?: number }).status;
      if (status === 401)
        message = "Invalid OpenAI API key. Check OPENAI_API_KEY in .env (or .env.local).";
      else if (status === 429) message = "OpenAI rate limit. Try again in a moment.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
