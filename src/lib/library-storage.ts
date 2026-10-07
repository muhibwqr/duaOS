/**
 * Client-side storage for Personal Library and Favorites.
 * Uses localStorage; no auth in MVP.
 */

import type { LibraryEntry, FavoriteItem, DuaRequest, DuaList, HistoryEntry } from "@/types/dua";
import { extractShareCode, decodeSharePayload, type SharePayload } from "@/lib/share-codec";

export const LIBRARY_KEY = "duaos-library";
export const FAVORITES_KEY = "duaos-favorites";
export const REQUESTS_KEY = "duaos-requests";
export const LISTS_KEY = "duaos-lists";
export const DISPLAY_NAME_KEY = "duaos-display-name";
export const MAX_FAVORITES_ITEMS = 50;
export const DUAOS_EXPORT_VERSION = 1;

export function getLibrary(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToLibrary(dua: string, name?: string): void {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LIBRARY_KEY) : null;
    const list: LibraryEntry[] = raw ? JSON.parse(raw) : [];
    list.push({ dua, name, at: new Date().toISOString() });
    if (typeof window !== "undefined") localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Save to library failed", e);
  }
}

export function removeFromLibrary(entry: LibraryEntry): LibraryEntry[] {
  try {
    const list = getLibrary().filter((e) => e.at !== entry.at || e.dua !== entry.dua);
    if (typeof window !== "undefined") localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error("Remove from library failed", e);
    return getLibrary();
  }
}

export function getFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFavorites(items: FavoriteItem[]): void {
  try {
    const list = items.slice(-MAX_FAVORITES_ITEMS);
    if (typeof window !== "undefined") localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Set favorites failed", e);
  }
}

/** Clear all favorites from storage. */
export function clearFavorites(): void {
  setFavorites([]);
}

export function addToFavorites(item: Omit<FavoriteItem, "id" | "addedAt">): FavoriteItem[] {
  const list = getFavorites();
  list.push({
    ...item,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  });
  setFavorites(list);
  return list;
}

export function removeFromFavorites(id: string): FavoriteItem[] {
  const list = getFavorites().filter((e) => e.id !== id);
  setFavorites(list);
  return list;
}

export function exportLibraryAsDuaOSJson(library: LibraryEntry[], favorites: FavoriteItem[]): string {
  const entries: LibraryEntry[] = [
    ...[...favorites].reverse().map((f) => ({ dua: f.dua, name: f.nameOfAllah, at: f.addedAt })),
    ...[...library].reverse().map((e) => ({ dua: e.dua, name: e.name, at: e.at })),
  ];
  return JSON.stringify({ duaos: "library", version: DUAOS_EXPORT_VERSION, entries });
}

export function parseDuaOSImport(raw: string): LibraryEntry[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as { duaos?: string; entries?: unknown[] };
    if (data.duaos === "library" && Array.isArray(data.entries)) {
      const entries: LibraryEntry[] = [];
      for (const e of data.entries) {
        const item = e as { dua?: unknown; name?: unknown; at?: unknown };
        if (typeof item.dua !== "string" || !item.dua.trim()) continue;
        entries.push({
          dua: item.dua.trim(),
          name: typeof item.name === "string" ? item.name.trim() || undefined : undefined,
          at: typeof item.at === "string" ? item.at : new Date().toISOString(),
        });
      }
      return entries;
    }
  } catch {
    // not JSON, try plain-text format
  }
  const lines = trimmed.split("\n");
  const entries: LibraryEntry[] = [];
  let currentDua = "";
  const flush = (name?: string) => {
    if (currentDua.trim()) {
      entries.push({ dua: currentDua.trim(), name: name?.trim() || undefined, at: new Date().toISOString() });
    }
    currentDua = "";
  };
  const isTitleLine = (line: string) => /du'a list/i.test(line) && /duaos/i.test(line);
  for (const line of lines) {
    if (line.startsWith("— ")) {
      flush(line.slice(2).trim());
    } else if (line.trim() === "") {
      flush();
    } else if (!isTitleLine(line)) {
      currentDua += (currentDua ? "\n" : "") + line;
    }
  }
  flush();
  return entries.length > 0 ? entries : null;
}

export function getRequests(): DuaRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === "string") : [];
  } catch {
    return [];
  }
}

function setRequests(list: DuaRequest[]): DuaRequest[] {
  try {
    if (typeof window !== "undefined") localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Set requests failed", e);
  }
  return list;
}

export function upsertRequest(r: DuaRequest): DuaRequest[] {
  const list = getRequests().filter((e) => e.id !== r.id);
  list.push(r);
  return setRequests(list);
}

export function removeRequest(id: string): DuaRequest[] {
  return setRequests(getRequests().filter((e) => e.id !== id));
}

export function markRequestMade(id: string): DuaRequest[] {
  return setRequests(
    getRequests().map((e) => (e.id === id ? { ...e, madeAt: new Date().toISOString() } : e))
  );
}

/** Normalize du'a text for dedupe: trim, collapse whitespace, lowercase. */
export function normalizeDuaText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function getLists(): DuaList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((l) => l && typeof l.id === "string") : [];
  } catch {
    return [];
  }
}

function setLists(list: DuaList[]): DuaList[] {
  try {
    if (typeof window !== "undefined") localStorage.setItem(LISTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Set lists failed", e);
  }
  return list;
}

export function upsertList(l: DuaList): DuaList[] {
  const list = getLists().filter((e) => e.id !== l.id);
  list.push(l);
  return setLists(list);
}

export function removeList(id: string): DuaList[] {
  return setLists(getLists().filter((e) => e.id !== id));
}

/** Add an entry to a list, deduped by normalized du'a text. Returns updated lists. */
export function addToList(id: string, entry: LibraryEntry): DuaList[] {
  const lists = getLists();
  const target = lists.find((l) => l.id === id);
  if (!target) return lists;
  const key = normalizeDuaText(entry.dua);
  if (!target.items.some((i) => normalizeDuaText(i.dua) === key)) {
    target.items = [...target.items, { dua: entry.dua, name: entry.name, from: entry.from, at: entry.at || new Date().toISOString() }];
    setLists(lists);
  }
  return lists;
}

export type ParsedImport =
  | { type: "entries"; entries: LibraryEntry[] }
  | { type: "list"; list: DuaList }
  | { type: "request"; request: DuaRequest }
  | {
      type: "state";
      library: LibraryEntry[];
      favorites: { dua: string; nameOfAllah?: string }[];
      lists: DuaList[];
      requests: DuaRequest[];
    };

/**
 * Async variant of parseDuaOSImport that also accepts share links/codes.
 * Returns entries for dua/list payloads, a request for request payloads, null otherwise.
 */
export async function parseDuaOSImportAsync(raw: string): Promise<ParsedImport | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const code = extractShareCode(trimmed);
  if (code) {
    const payload = await decodeSharePayload(code);
    if (!payload) return null;
    const now = new Date().toISOString();
    if (payload.kind === "dua") {
      return {
        type: "entries",
        entries: [{ dua: payload.item.dua.trim(), name: payload.item.name?.trim() || undefined, from: payload.item.from?.trim() || undefined, at: payload.item.at || now }],
      };
    }
    if (payload.kind === "list") {
      if (payload.id) {
        return {
          type: "list",
          list: {
            id: payload.id,
            title: payload.title?.trim() || "Shared list",
            umrah: payload.umrah,
            items: payload.items.map((i) => ({ dua: i.dua.trim(), name: i.name?.trim() || undefined, from: i.from?.trim() || undefined, at: i.at || now })),
            at: now,
          },
        };
      }
      return {
        type: "entries",
        entries: payload.items.map((i) => ({ dua: i.dua.trim(), name: i.name?.trim() || undefined, from: i.from?.trim() || undefined, at: i.at || now })),
      };
    }
    if (payload.kind === "state") {
      return {
        type: "state",
        library: payload.library.map((i) => ({ dua: i.dua.trim(), name: i.name?.trim() || undefined, from: i.from?.trim() || undefined, at: i.at || now })),
        favorites: payload.favorites.map((i) => ({ dua: i.dua.trim(), nameOfAllah: i.name?.trim() || undefined })),
        lists: payload.lists.map((l) => ({
          id: l.id,
          title: l.title,
          items: l.items.map((i) => ({ dua: i.dua.trim(), name: i.name?.trim() || undefined, from: i.from?.trim() || undefined, at: i.at || now })),
          at: l.at || now,
        })),
        requests: payload.requests.map((r) => ({ ...r, direction: "received" as const })),
      };
    }
    return { type: "request", request: { ...payload.request, direction: "received" } };
  }
  const entries = parseDuaOSImport(trimmed);
  return entries && entries.length > 0 ? { type: "entries", entries } : null;
}

/** Merge a state payload's library entries, deduped by normalized text. */
export function mergeLibraryDeduped(entries: LibraryEntry[]): number {
  if (typeof window === "undefined" || entries.length === 0) return 0;
  const list = getLibrary();
  const seen = new Set(list.map((e) => normalizeDuaText(e.dua)));
  const now = new Date().toISOString();
  let added = 0;
  for (const e of entries) {
    const key = normalizeDuaText(e.dua);
    const existing = list.find((x) => normalizeDuaText(x.dua) === key);
    if (existing) {
      if (!existing.name && e.name) existing.name = e.name;
      if (!existing.from && e.from) existing.from = e.from;
      continue;
    }
    seen.add(key);
    list.push({ dua: e.dua, name: e.name, from: e.from, at: e.at || now });
    added++;
  }
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  return added;
}

/** Merge favorites deduped by normalized du'a text. Returns count added. */
export function mergeFavoritesDeduped(items: { dua: string; nameOfAllah?: string }[]): number {
  const existing = getFavorites();
  const seen = new Set(existing.map((f) => normalizeDuaText(f.dua)));
  let added = 0;
  for (const i of items) {
    const key = normalizeDuaText(i.dua);
    if (seen.has(key)) continue;
    seen.add(key);
    addToFavorites({ dua: i.dua, nameOfAllah: i.nameOfAllah });
    added++;
  }
  return added;
}

/** Apply a decoded state import: merge library/favorites/lists/requests without duplicating. */
export function applyState(state: Extract<ParsedImport, { type: "state" }>): { duas: number; lists: number } {
  const duas = mergeLibraryDeduped(state.library) + mergeFavoritesDeduped(state.favorites);
  const existingLists = getLists();
  let listsAdded = 0;
  const seenIds = new Set(existingLists.map((l) => l.id));
  for (const l of state.lists) {
    upsertList(l);
    if (!seenIds.has(l.id)) listsAdded++;
  }
  for (const r of state.requests) {
    const existing = getRequests().find((e) => e.id === r.id);
    upsertRequest({ ...r, madeAt: existing?.madeAt ?? r.madeAt });
  }
  return { duas, lists: listsAdded };
}

/** Build a state payload snapshot of current local storage. */
export function buildStatePayload(): SharePayload {
  const now = new Date().toISOString();
  return {
    v: 1,
    kind: "state",
    library: getLibrary().map((e) => ({ dua: e.dua, name: e.name, from: e.from, at: e.at })),
    favorites: getFavorites().map((f) => ({ dua: f.dua, name: f.nameOfAllah, at: f.addedAt })),
    lists: getLists().map((l) => ({
      id: l.id,
      title: l.title,
      items: l.items.map((i) => ({ dua: i.dua, name: i.name, from: i.from, at: i.at || now })),
      at: l.at,
    })),
    requests: getRequests().map((r) => ({
      id: r.id,
      text: r.text,
      name: r.name,
      from: r.from,
      at: r.at,
    })),
  };
}

/** Merge entries into the library, deduped by normalized text. Returns count actually added. */
export function mergeIntoLibrary(entries: LibraryEntry[]): number {
  return mergeLibraryDeduped(entries);
}

/* ---------- Umrah list ---------- */

export const UMRAH_LIST_ID = "umrah";
export const UMRAH_LIST_TITLE = "My Umrah du'as";
export const UMRAH_DONE_KEY = "duaos-umrah-done";

/** The Umrah list: a DuaList with fixed id. Creates an empty in-memory one if missing. */
export function getUmrahList(): DuaList {
  return (
    getLists().find((l) => l.id === UMRAH_LIST_ID) ?? {
      id: UMRAH_LIST_ID,
      title: UMRAH_LIST_TITLE,
      items: [],
      at: new Date().toISOString(),
      umrah: true,
    }
  );
}

/** Merge items into the Umrah list, deduped by normalized text. Fills missing name/from on existing. */
export function addToUmrahList(items: LibraryEntry[]): { added: number; skipped: number } {
  const list = getUmrahList();
  const seen = new Set(list.items.map((i) => normalizeDuaText(i.dua)));
  const now = new Date().toISOString();
  let added = 0;
  for (const e of items) {
    const key = normalizeDuaText(e.dua);
    if (!key) continue;
    const existing = list.items.find((x) => normalizeDuaText(x.dua) === key);
    if (existing) {
      if (!existing.name && e.name) existing.name = e.name;
      if (!existing.from && e.from) existing.from = e.from;
      continue;
    }
    seen.add(key);
    list.items.push({ dua: e.dua, name: e.name, from: e.from, at: e.at || now });
    added++;
  }
  upsertList({ ...list, umrah: true });
  return { added, skipped: items.length - added };
}

export function removeFromUmrahList(dua: string): DuaList {
  const list = getUmrahList();
  const key = normalizeDuaText(dua);
  list.items = list.items.filter((i) => normalizeDuaText(i.dua) !== key);
  upsertList(list);
  setUmrahDone(getUmrahDone().filter((k) => k !== key));
  return list;
}

export function getUmrahDone(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(UMRAH_DONE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function setUmrahDone(keys: string[]): string[] {
  try {
    if (typeof window !== "undefined") localStorage.setItem(UMRAH_DONE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error("Set umrah done failed", e);
  }
  return keys;
}

export function toggleUmrahDone(dua: string): string[] {
  const key = normalizeDuaText(dua);
  const done = getUmrahDone();
  const next = done.includes(key) ? done.filter((k) => k !== key) : [...done, key];
  return setUmrahDone(next);
}

export const HISTORY_KEY = "duaos-history";
const MAX_HISTORY_ITEMS = 50;

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((h) => h && typeof h.id === "string" && typeof h.query === "string" && h.result != null) : [];
  } catch {
    return [];
  }
}

function setHistoryList(list: HistoryEntry[]): HistoryEntry[] {
  try {
    if (typeof window !== "undefined") localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Set history failed", e);
  }
  return list;
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">): HistoryEntry {
  const list = getHistory();
  const at = new Date().toISOString();
  const top = list[0];
  if (top && normalizeDuaText(top.query) === normalizeDuaText(entry.query) && top.intent === entry.intent) {
    const replaced: HistoryEntry = { ...entry, id: top.id, at };
    setHistoryList([replaced, ...list.slice(1)]);
    return replaced;
  }
  const h: HistoryEntry = { ...entry, id: crypto.randomUUID(), at };
  setHistoryList([h, ...list].slice(0, MAX_HISTORY_ITEMS));
  return h;
}

export function updateHistoryRefined(id: string, refinedDua: string): HistoryEntry[] {
  const list = getHistory();
  const idx = list.findIndex((h) => h.id === id);
  if (idx === -1) return list;
  const next = [...list];
  next[idx] = { ...next[idx], refinedDua };
  return setHistoryList(next);
}

export function removeHistory(id: string): HistoryEntry[] {
  return setHistoryList(getHistory().filter((h) => h.id !== id));
}

export function clearHistory(): void {
  try {
    if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
