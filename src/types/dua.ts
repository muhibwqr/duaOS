/** Shared types for search results, library, and favorites. */

export type Intent = "problem" | "refine" | "goal";

export type SearchResultItem = { id: string; content: string; metadata: Record<string, unknown> };

export type SearchResult = {
  name: SearchResultItem | null;
  hadith: SearchResultItem | null;
  hadiths: SearchResultItem[];
  quran?: SearchResultItem | null;
  quranVerses?: SearchResultItem[];
};

export type LibraryEntry = { dua: string; name?: string; from?: string; at: string };

export type FavoriteItem = {
  id: string;
  dua: string;
  nameOfAllah?: string;
  hadithSnippet?: string;
  addedAt: string;
};

export type DuaList = { id: string; title: string; items: LibraryEntry[]; at: string; umrah?: boolean };

export type DuaRequest = {
  id: string;
  text: string;
  name?: string;
  from?: string;
  at: string;
  direction: "sent" | "received";
  code?: string;
  madeAt?: string;
};
