import { NextResponse } from "next/server";
import OpenAI from "openai";
import { rateLimitSearch } from "@/lib/rate-limit";

const MAX_TEXT_LENGTH = 4000;

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
    if (!apiKey) {
      return NextResponse.json({ error: "Service unavailable. Check OPENAI_API_KEY." }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const text = body && typeof body === "object" && "text" in body ? String((body as { text?: unknown }).text ?? "").trim() : "";
    if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Text must be ${MAX_TEXT_LENGTH} chars or less.` }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You translate Arabic source text into accurate, concise English. Return only the translation text, no extra commentary.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
    });

    const translation = result.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ translation });
  } catch (e: unknown) {
    console.error("Translate source error:", e);
    let message = "Translation failed.";
    if (e && typeof e === "object" && "status" in e) {
      const status = (e as { status?: number }).status;
      if (status === 401) message = "Invalid OpenAI API key. Check OPENAI_API_KEY.";
      else if (status === 429) message = "OpenAI rate limit. Try again in a moment.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

