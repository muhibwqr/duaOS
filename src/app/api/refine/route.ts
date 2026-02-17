import { duaAgent } from "@/mastra/agents/dua-agent";
import { refineBodySchema } from "@/lib/validation";
import { rateLimitRefine } from "@/lib/rate-limit";

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
    const parsed = refineBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { userInput, nameOfAllah, hadith } = parsed.data;

    const context = [nameOfAllah, hadith].filter(Boolean).join("\n");
    const instructions = context
      ? `Use this context to shape the du'a:\n${context}\n\nRewrite the user's input into a Prophetic-style du'a. Keep it under 100 tokens.`
      : undefined;

    const result = await duaAgent.stream(
      [{ role: "user", content: userInput }],
      { instructions }
    );

    const textStream = result.textStream;
    return new Response(textStream as unknown as BodyInit, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    console.error("Refine error:", e);
    return new Response(
      JSON.stringify({ error: "Refinement failed." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
