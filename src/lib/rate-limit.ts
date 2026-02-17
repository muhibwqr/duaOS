/**
 * In-memory rate limiter by IP.
 * Resets on server restart. For production at scale, use Redis (e.g. Upstash).
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SEARCH_PER_WINDOW = 20;
const MAX_REFINE_PER_WINDOW = 10;
const MAX_TRANSCRIBE_PER_WINDOW = 15;

type Entry = { count: number; resetAt: number };
const searchStore = new Map<string, Entry>();
const refineStore = new Map<string, Entry>();
const transcribeStore = new Map<string, Entry>();

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function checkLimit(store: Map<string, Entry>, key: string, max: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}

export function rateLimitSearch(req: Request): { ok: boolean; retryAfter?: number } {
  return checkLimit(searchStore, getClientIdentifier(req), MAX_SEARCH_PER_WINDOW);
}

export function rateLimitRefine(req: Request): { ok: boolean; retryAfter?: number } {
  return checkLimit(refineStore, getClientIdentifier(req), MAX_REFINE_PER_WINDOW);
}

export function rateLimitTranscribe(req: Request): { ok: boolean; retryAfter?: number } {
  return checkLimit(transcribeStore, getClientIdentifier(req), MAX_TRANSCRIBE_PER_WINDOW);
}
