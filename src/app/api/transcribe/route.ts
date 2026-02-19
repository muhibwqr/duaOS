import { NextResponse } from "next/server";
import OpenAI from "openai";
import { rateLimitTranscribe } from "@/lib/rate-limit";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = ["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg"];

export async function POST(req: Request) {
  try {
    const rate = rateLimitTranscribe(req);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: rate.retryAfter },
        { status: 429, headers: rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : undefined }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service unavailable. Check OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
    }

    const file = formData.get("file") ?? formData.get("audio");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing or invalid audio file." }, { status: 400 });
    }

    const languageParam = formData.get("language");
    const language = typeof languageParam === "string" && languageParam.trim() ? languageParam.trim() : undefined;

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    const type = file.type?.toLowerCase() ?? "";
    const allowed = ALLOWED_TYPES.some((t) => type.includes(t) || type === t) || type.startsWith("audio/");
    if (!allowed) {
      return NextResponse.json(
        { error: "Unsupported audio type. Use WebM, MP3, MP4, WAV, or OGG." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const transcription = await openai.audio.transcriptions.create({
      file: file as unknown as File,
      model: "whisper-1",
      ...(language ? { language } : {}),
    });

    return NextResponse.json({ text: transcription.text ?? "" });
  } catch (e: unknown) {
    console.error("Transcribe error:", e);
    let message = "Transcription failed.";
    if (e && typeof e === "object" && "status" in e) {
      const status = (e as { status?: number }).status;
      if (status === 401) message = "Invalid OpenAI API key. Check OPENAI_API_KEY.";
      else if (status === 429) message = "OpenAI rate limit. Try again in a moment.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
