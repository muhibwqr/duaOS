/**
 * Share codec: encode/decode share payloads (du'a, list, request) into compact
 * link-safe codes. Payloads live entirely in the URL hash — nothing is uploaded.
 *
 * Format: "<prefix>.<base64url>" where prefix is "z" (deflate-raw compressed)
 * or "j" (plain JSON fallback when CompressionStream is unavailable).
 */

export const SHARE_VERSION = 1;

export type SharedDua = { dua: string; name?: string; sources?: string[]; at?: string };
export type SharedRequest = { id: string; text: string; name?: string; from?: string; at: string };

export type SharePayload =
  | { v: 1; kind: "dua"; item: SharedDua }
  | { v: 1; kind: "list"; title?: string; items: SharedDua[] }
  | { v: 1; kind: "request"; request: SharedRequest };

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function isSharedDua(d: unknown): d is SharedDua {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  if (typeof o.dua !== "string" || !o.dua.trim()) return false;
  if (o.name !== undefined && typeof o.name !== "string") return false;
  if (o.at !== undefined && typeof o.at !== "string") return false;
  if (o.sources !== undefined && !(Array.isArray(o.sources) && o.sources.every((s) => typeof s === "string"))) return false;
  return true;
}

function isSharedRequest(r: unknown): r is SharedRequest {
  if (typeof r !== "object" || r === null) return false;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return false;
  if (typeof o.text !== "string" || !o.text.trim()) return false;
  if (typeof o.at !== "string") return false;
  if (o.name !== undefined && typeof o.name !== "string") return false;
  if (o.from !== undefined && typeof o.from !== "string") return false;
  return true;
}

function isSharePayload(p: unknown): p is SharePayload {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  if (o.v !== SHARE_VERSION) return false;
  if (o.kind === "dua") return isSharedDua(o.item);
  if (o.kind === "list") {
    if (o.title !== undefined && typeof o.title !== "string") return false;
    return Array.isArray(o.items) && o.items.length > 0 && o.items.every(isSharedDua);
  }
  if (o.kind === "request") return isSharedRequest(o.request);
  return false;
}

/** Extract the share code from a full URL (hash after /s#) or a bare z./j. code. */
export function extractShareCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[zj]\.[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    if (url.pathname.replace(/\/+$/, "").endsWith("/s") && /^[zj]\.[A-Za-z0-9_-]+$/.test(hash)) {
      return hash;
    }
  } catch {
    // not a URL
  }
  return null;
}

export function buildShareUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/s#${code}`;
}

export async function encodeSharePayload(p: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p));
  if (typeof CompressionStream !== "undefined") {
    try {
      return `z.${bytesToBase64Url(await deflateRaw(json))}`;
    } catch {
      // fall through to plain encoding
    }
  }
  return `j.${bytesToBase64Url(json)}`;
}

export async function decodeSharePayload(code: string): Promise<SharePayload | null> {
  try {
    const extracted = extractShareCode(code);
    if (!extracted) return null;
    const [prefix, body] = [extracted.slice(0, 1), extracted.slice(2)];
    const bytes = base64UrlToBytes(body);
    if (!bytes) return null;
    let json: Uint8Array;
    if (prefix === "z") {
      if (typeof DecompressionStream === "undefined") return null;
      json = await inflateRaw(bytes);
    } else if (prefix === "j") {
      json = bytes;
    } else {
      return null;
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(json));
    return isSharePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
