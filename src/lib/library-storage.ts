/**
 * Client-side storage for Personal Library and Favorites.
 * Uses localStorage; no auth in MVP.
 */

import type { LibraryEntry, FavoriteItem } from "@/types/dua";

export const LIBRARY_KEY = "duaos-library";
export const FAVORITES_KEY = "duaos-favorites";
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

export function mergeIntoLibrary(entries: LibraryEntry[]): void {
  if (typeof window === "undefined" || entries.length === 0) return;
  const raw = localStorage.getItem(LIBRARY_KEY);
  const list: LibraryEntry[] = raw ? JSON.parse(raw) : [];
  const now = new Date().toISOString();
  for (const e of entries) {
    list.push({ dua: e.dua, name: e.name, at: e.at || now });
  }
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}
