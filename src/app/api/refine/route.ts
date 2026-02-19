import { duaAgent, DUAOS_AGENT_BASE_PROMPT } from "@/mastra/agents/dua-agent";
import { refineBodySchema } from "@/lib/validation";
import { rateLimitRefine } from "@/lib/rate-limit";
import { NAMES_OF_ALLAH_REFINE_CONTEXT } from "@/data/names-context";

export async function POST(req: Request) {
  try {
    const rate = rateLimitRefine(req);
    if (!rate.ok) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
          retryAfter: rate.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...(rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : {}),
          },
        }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Service unavailable. Check OPENAI_API_KEY." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = refineBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { userInput, nameOfAllah, hadith, quran } = parsed.data;

    const contextLines: string[] = [];
    if (nameOfAllah?.trim()) contextLines.push(`Name of Allah: ${nameOfAllah.trim()}`);
    if (quran?.trim()) {
      const verses = quran.trim().split("\n\n").filter(Boolean);
      if (verses.length === 1) {
        contextLines.push(`Quranic Verse (with citation):\n${verses[0]}`);
      } else {
        contextLines.push(`Quranic Verses (with citations):\n${verses.map((v, i) => `${i + 1}. ${v}`).join("\n")}`);
      }
    }
    if (hadith?.trim()) {
      const parts = hadith.trim().split("\n\n").filter(Boolean);
      if (parts.length === 1) {
        contextLines.push(`Relevant Hadith (with reference):\n${parts[0]}`);
      } else {
        contextLines.push(`Relevant Hadiths (with references):\n${parts.map((h, i) => `${i + 1}. ${h}`).join("\n\n")}`);
      }
    }
    const contextBlock =
      contextLines.length > 0
        ? `CURRENT SPIRITUAL CONTEXT (use ALL of these cited sources to build a comprehensive response—each verse/hadith has a clear source):\n\n${contextLines.join("\n\n")}`
        : `CURRENT SPIRITUAL CONTEXT:\nNo specific context was provided. Select the single most relevant Name from the list below for the user's intention.\n\n${NAMES_OF_ALLAH_REFINE_CONTEXT}`;

    const fullSystemMessage = `${DUAOS_AGENT_BASE_PROMPT}\n\n---\n\n${contextBlock}`;
    const safeInput = String(userInput).trim().replace(/"/g, "'");
    const userMessage = `USER INTENTION: "${safeInput}"`;

    const result = await duaAgent.stream(
      [{ role: "user", content: userMessage }],
      { instructions: fullSystemMessage }
    );

    const textStream = result.textStream;
    return new Response(textStream as unknown as BodyInit, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e: unknown) {
    console.error("Refine error:", e);
    let message = "Refinement failed.";
    if (e && typeof e === "object" && "status" in e) {
      const status = (e as { status?: number }).status;
      if (status === 401) message = "Invalid OpenAI API key. Check OPENAI_API_KEY in .env (or .env.local).";
      else if (status === 429) message = "OpenAI rate limit. Try again in a moment.";
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
