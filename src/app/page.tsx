"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import ReactMarkdown from "react-markdown";
import { ArrowRight, CheckCircle2, ChevronDown, Copy, Mic, Plus, Share2, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { KofiBanner } from "@/components/KofiBanner";
import { Button } from "@/components/ui/button";
import { DuaShareCard } from "@/components/DuaShareCard";
import { HADITH_EDITIONS, HADITH_EDITION_LABELS, MAX_HADITH_CONTEXT_LENGTH } from "@/lib/validation";
import { localMatch } from "@/lib/local-match";
import namesOfAllah from "@/data/names-of-allah.json";

/** Strip markdown to plain text for share card image (reliable PNG capture). */
function stripMarkdownForShare(text: string): string {
  return text
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/** Extract the "personal du'a" section (section 3) from refined output for the share card. */
function extractPersonalDua(refinedDua: string): string {
  const stripped = stripMarkdownForShare(refinedDua);
  const section3 = stripped.match(/3\.\s*A personalized du'a[^\n]*\n([\s\S]*?)(?=\n\s*4\.|$)/i);
  if (section3?.[1]) return section3[1].trim();
  const afterPersonal = stripped.match(/personal(?:ized)?\s*du'a[^\n]*\n([\s\S]*?)(?=\n\s*4\.|\n\s*When to make|$)/i);
  if (afterPersonal?.[1]) return afterPersonal[1].trim();
  return stripped.slice(0, 1200);
}

const MUHIB_URL = "https://muhibwaqar.com";
const HADITH_EDITION_STORAGE_KEY = "duaos-hadith-edition";

type Intent = "problem" | "refine" | "goal";

type SearchResultItem = { id: string; content: string; metadata: Record<string, unknown> };

type SearchResult = {
  name: SearchResultItem | null;
  hadith: SearchResultItem | null;
  hadiths: SearchResultItem[];
  quran?: SearchResultItem | null;
  quranVerses?: SearchResultItem[];
};

type LibraryEntry = { dua: string; name?: string; at: string };

type FavoriteItem = {
  id: string;
  dua: string;
  nameOfAllah?: string;
  hadithSnippet?: string;
  addedAt: string;
};

const LIBRARY_KEY = "duaos-library";
const FAVORITES_KEY = "duaos-favorites";
const MAX_FAVORITES_ITEMS = 50;
/** Match server limits so we don't send oversized payloads (server validates anyway). */
const MAX_QUERY_LENGTH = 2000;

/** Three suggestion pills below the input: fill the box only, no API call. */
const INPUT_SUGGESTIONS: readonly string[] = [
  "Guidance in a difficult decision",
  "Patience during hardship",
  "Protection for my family",
];

const PLACEHOLDER_CYCLE_MS = 3500;
const PLACEHOLDER_FADE_MS = 400;
const MAX_REFINE_INPUT_LENGTH = 5000;
const MAX_CONTEXT_LENGTH = 2000;
const ARABIC_TEXT_RE = /[\u0600-\u06FF]/;

function getLibrary(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLibrary(dua: string, name?: string) {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LIBRARY_KEY) : null;
    const list: { dua: string; name?: string; at: string }[] = raw ? JSON.parse(raw) : [];
    list.push({ dua, name, at: new Date().toISOString() });
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Save to library failed", e);
  }
}

function removeFromLibrary(entry: LibraryEntry): LibraryEntry[] {
  try {
    const list = getLibrary().filter((e) => e.at !== entry.at || e.dua !== entry.dua);
    if (typeof window !== "undefined") localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error("Remove from library failed", e);
    return getLibrary();
  }
}

function getFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFavorites(items: FavoriteItem[]) {
  try {
    const list = items.slice(-MAX_FAVORITES_ITEMS);
    if (typeof window !== "undefined") localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Set favorites failed", e);
  }
}

function addToFavorites(item: Omit<FavoriteItem, "id" | "addedAt">) {
  const list = getFavorites();
  list.push({
    ...item,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  });
  setFavorites(list);
  return list;
}

function removeFromFavorites(id: string) {
  const list = getFavorites().filter((e) => e.id !== id);
  setFavorites(list);
  return list;
}

const DUAOS_EXPORT_VERSION = 1;

/** Serialize library + favorites to DuaOS JSON format for import by others. */
function exportLibraryAsDuaOSJson(library: LibraryEntry[], favorites: FavoriteItem[]): string {
  const entries: { dua: string; name?: string; at: string }[] = [
    ...[...favorites].reverse().map((f) => ({ dua: f.dua, name: f.nameOfAllah, at: f.addedAt })),
    ...[...library].reverse().map((e) => ({ dua: e.dua, name: e.name, at: e.at })),
  ];
  return JSON.stringify({ duaos: "library", version: DUAOS_EXPORT_VERSION, entries });
}

/** Parse pasted/file content: DuaOS JSON or plain-text list. Returns entries to merge or null on failure. */
function parseDuaOSImport(raw: string): LibraryEntry[] | null {
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
    // not JSON, try plain-text format (My du'a list — Du'aOS, then blocks of du'a + "— Name")
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
      const name = line.slice(2).trim();
      flush(name);
    } else if (line.trim() === "") {
      flush();
    } else if (!isTitleLine(line)) {
      currentDua += (currentDua ? "\n" : "") + line;
    }
  }
  flush();
  return entries.length > 0 ? entries : null;
}

/** Merge entries into library (one read, append, one write). */
function mergeIntoLibrary(entries: LibraryEntry[]): void {
  if (typeof window === "undefined" || entries.length === 0) return;
  const raw = localStorage.getItem(LIBRARY_KEY);
  const list: LibraryEntry[] = raw ? JSON.parse(raw) : [];
  const now = new Date().toISOString();
  for (const e of entries) {
    list.push({ dua: e.dua, name: e.name, at: e.at || now });
  }
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}

/** Fire-and-forget: store du'a on server for counter and similarity. Does not block UI. */
function storeDuaOnServer(payload: {
  content: string;
  nameOfAllah?: string;
  hadithSnippet?: string;
  intent?: Intent;
}) {
  fetch("/api/duas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((e) => console.warn("Store du'a on server failed:", e));
}

export default function Home() {
  const [intent, setIntent] = useState<Intent>("problem");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [refinedDua, setRefinedDua] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [saved, setSaved] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [favorites, setFavoritesState] = useState<FavoriteItem[]>([]);
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null);
  const [listShareFeedback, setListShareFeedback] = useState<"copied" | "shared" | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalStep, setShareModalStep] = useState<"intention" | "options">("intention");
  const [shareError, setShareError] = useState<string | null>(null);
  const sharePngRef = useRef<string | null>(null);
  const [usedFailsafe, setUsedFailsafe] = useState(false);
  const [sourcesPopupOpen, setSourcesPopupOpen] = useState(false);
  const [sourceTranslations, setSourceTranslations] = useState<Record<string, string>>({});
  const [translatingSource, setTranslatingSource] = useState<Record<string, boolean>>({});
  const [edition, setEdition] = useState<string>("");
  const [availableEditions, setAvailableEditions] = useState<string[]>([]);

  // Sync edition from localStorage after mount to avoid hydration mismatch (server has no localStorage).
  useEffect(() => {
    try {
      const s = localStorage.getItem(HADITH_EDITION_STORAGE_KEY);
      const value = s && (s === "" || HADITH_EDITIONS.includes(s as (typeof HADITH_EDITIONS)[number])) ? s : "";
      setEdition(value);
    } catch {
      // ignore
    }
  }, []);
  const [selectedRefinedText, setSelectedRefinedText] = useState<string | null>(null);
  const [savedSelectionFeedback, setSavedSelectionFeedback] = useState(false);
  const refinedContentRef = useRef<HTMLDivElement | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [exportToNotesFeedback, setExportToNotesFeedback] = useState<string | null>(null);
  const [shareForDuaOSFeedback, setShareForDuaOSFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLibrary(getLibrary());
  }, [saved]);

  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(false);

  useEffect(() => {
    setFavoritesState(getFavorites());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hadith-editions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { editions?: string[] } | null) => {
        if (cancelled) return;
        const list = Array.isArray(data?.editions)
          ? data.editions.filter((e): e is string => typeof e === "string" && HADITH_EDITIONS.includes(e as (typeof HADITH_EDITIONS)[number]))
          : [];
        setAvailableEditions(list);
      })
      .catch(() => {
        if (!cancelled) setAvailableEditions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (edition !== "" && !availableEditions.includes(edition)) {
      setEdition("");
    }
  }, [edition, availableEditions]);

  useEffect(() => {
    if (searchResult !== null) setSourcesPopupOpen(true);
  }, [searchResult]);

  useEffect(() => {
    try {
      localStorage.setItem(HADITH_EDITION_STORAGE_KEY, edition);
    } catch {
      // ignore
    }
  }, [edition]);

  useEffect(() => {
    const step = () => {
      setPlaceholderVisible(false);
      const t = setTimeout(() => {
        setSuggestionIndex((i) => (i + 1) % INPUT_SUGGESTIONS.length);
        setPlaceholderVisible(true);
      }, PLACEHOLDER_FADE_MS);
      return () => clearTimeout(t);
    };
    const id = setInterval(step, PLACEHOLDER_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  async function handleSearch(overrideQuery?: string) {
    const q = (overrideQuery ?? query).trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return;
    if (overrideQuery) setQuery(overrideQuery);
    setSearchResult(null);
    setSearchError(null);
    setRefinedDua("");

    const local = localMatch(q, namesOfAllah as { arabic: string; english: string; meaning: string; tags: string[] }[]);

    setIsSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, intent, edition: edition || undefined }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text);
          if (j.error) msg = j.error;
        } catch {
          // use raw text
        }
        setSearchError(msg);
        setSearchResult({ name: null, hadith: null, hadiths: [] });
        return;
      }
      const data = JSON.parse(text);
      const hadithList = Array.isArray(data.hadiths) ? data.hadiths : (data.hadith ? [data.hadith] : []);
      setUsedFailsafe(true);
      const quranList = Array.isArray(data.quranVerses) ? data.quranVerses : (data.quran ? [data.quran] : []);
      setSearchResult({
        name: data.name ?? local?.name ?? null,
        hadith: data.hadith ?? hadithList[0] ?? null,
        hadiths: hadithList,
        quran: data.quran ?? null,
        quranVerses: quranList,
      });
    } catch (e) {
      console.error(e);
      if (local) {
        setUsedFailsafe(false);
        setSearchError("Search service unavailable. Showing local Name match.");
        setSearchResult({ name: local.name, hadith: local.hadith, hadiths: [], quran: local.quran ?? null });
      } else {
        setSearchError(e instanceof Error ? e.message : "Search failed. Check your connection and try again.");
        setSearchResult({ name: null, hadith: null, hadiths: [] });
      }
    } finally {
      setIsSearching(false);
    }
  }

  function isArabicText(text: string): boolean {
    return ARABIC_TEXT_RE.test(text);
  }

  async function ensureSourceTranslation(key: string, text: string) {
    if (!text || sourceTranslations[key] || translatingSource[key]) return;
    setTranslatingSource((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/translate-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (typeof data.translation === "string" && data.translation.trim()) {
        setSourceTranslations((prev) => ({ ...prev, [key]: data.translation.trim() }));
      }
    } finally {
      setTranslatingSource((prev) => ({ ...prev, [key]: false }));
    }
  }

  useEffect(() => {
    const q = searchResult?.quran;
    if (!q?.content || !isArabicText(q.content)) return;
    const key = `quran-${q.id ?? q.metadata?.reference ?? "current"}`;
    void ensureSourceTranslation(key, q.content);
  }, [searchResult?.quran?.id, searchResult?.quran?.content]);

  function buildHadithContext(hadiths: SearchResultItem[]): string {
    const withRef = hadiths.filter((m) => typeof m.metadata?.reference === "string" && m.metadata.reference.trim() !== "");
    if (!withRef.length) return "";
    const ref = (m: SearchResultItem) => (typeof m.metadata?.reference === "string" ? m.metadata.reference : "");
    const parts: string[] = [];
    const showFull = 3;
    for (let i = 0; i < withRef.length; i++) {
      if (i < showFull) {
        const r = ref(withRef[i]);
        parts.push(r ? `${withRef[i].content} [${r}]` : withRef[i].content);
      } else {
        parts.push(ref(withRef[i]) || `Hadith ${i + 1}`);
      }
    }
    const moreRefs = withRef.length > showFull
      ? `\nAlso relevant (by relevance): ${parts.slice(showFull).join(", ")}`
      : "";
    return (parts.slice(0, showFull).join("\n\n") + moreRefs).slice(0, MAX_HADITH_CONTEXT_LENGTH);
  }

  function buildQuranContext(verses: SearchResultItem[]): string {
    const withRef = verses.filter(
      (v) =>
        (typeof v.metadata?.reference === "string" && v.metadata.reference.trim() !== "") ||
        (typeof v.metadata?.surah === "string" && v.metadata.surah.trim() !== "")
    );
    if (!withRef.length) return "";
    const parts: string[] = [];
    for (let i = 0; i < Math.min(withRef.length, 5); i++) {
      const v = withRef[i];
      const surah = typeof v.metadata?.surah === "string" ? v.metadata.surah : "";
      const ref = typeof v.metadata?.reference === "string" ? v.metadata.reference : "";
      const source = [surah, ref].filter(Boolean).join(" ").trim();
      parts.push(source ? `${v.content} [${source}]` : v.content);
    }
    return parts.join("\n\n").slice(0, MAX_HADITH_CONTEXT_LENGTH);
  }

  async function handleRefine() {
    const text = (query.trim() || refinedDua).slice(0, MAX_REFINE_INPUT_LENGTH);
    if (!text) return;
    const nameContent = (searchResult?.name?.content ?? "").slice(0, MAX_CONTEXT_LENGTH);
    const hadiths = searchResult?.hadiths ?? (searchResult?.hadith ? [searchResult.hadith] : []);
    const hadithContent = buildHadithContext(hadiths);
    const quranVerses = searchResult?.quranVerses ?? (searchResult?.quran ? [searchResult.quran] : []);
    const quranContent = buildQuranContext(quranVerses);
    setIsRefining(true);
    setRefinedDua("");
    setSaved(false);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: text,
          nameOfAllah: nameContent || undefined,
          hadith: hadithContent || undefined,
          quran: quranContent || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let out = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          out += chunk;
          setRefinedDua(out);
        }
      }
    } catch (e) {
      console.error(e);
      setRefinedDua("Refinement failed. Check the console.");
    } finally {
      setIsRefining(false);
    }
  }

  function updateRefinedSelection() {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const node = refinedContentRef.current;
    if (!node || !sel || sel.rangeCount === 0) {
      setSelectedRefinedText(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!range.intersectsNode(node)) {
      setSelectedRefinedText(null);
      return;
    }
    const text = sel.toString().trim();
    setSelectedRefinedText(text || null);
  }

  function handleSaveToLibrary() {
    const text = refinedDua.trim();
    if (!text) return;
    saveToLibrary(text, searchResult?.name?.content);
    setSaved(true);
    setLibrary(getLibrary());
    storeDuaOnServer({
      content: text,
      nameOfAllah: searchResult?.name?.content,
      hadithSnippet: searchResult?.hadith?.content,
      intent,
    });
  }

  function handleSaveSelectionToLibrary() {
    const text = selectedRefinedText?.trim();
    if (!text) return;
    saveToLibrary(text, searchResult?.name?.content);
    setLibrary(getLibrary());
    setSavedSelectionFeedback(true);
    if (typeof window !== "undefined" && window.getSelection()) window.getSelection()?.removeAllRanges();
    setSelectedRefinedText(null);
    setTimeout(() => setSavedSelectionFeedback(false), 2000);
  }

  function handleAddToFavorites() {
    const text = refinedDua.trim();
    if (!text) return;
    addToFavorites({
      dua: text,
      nameOfAllah: searchResult?.name?.content,
      hadithSnippet: searchResult?.hadith?.content,
    });
    setFavoritesState(getFavorites());
    storeDuaOnServer({
      content: text,
      nameOfAllah: searchResult?.name?.content,
      hadithSnippet: searchResult?.hadith?.content,
      intent,
    });
  }

  function handleSaveFromFavorites(item: FavoriteItem) {
    saveToLibrary(item.dua, item.nameOfAllah);
    setLibrary(getLibrary());
    setFavoritesState(removeFromFavorites(item.id));
  }

  function handleAddDuaToFavorites(payload: { dua: string; nameOfAllah?: string; hadithSnippet?: string }) {
    addToFavorites(payload);
    setFavoritesState(getFavorites());
  }

  function handleRemoveFromLibrary(entry: LibraryEntry) {
    setLibrary(removeFromLibrary(entry));
  }

  function handleCopyDua(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedbackId(id);
      setTimeout(() => setCopyFeedbackId(null), 1500);
    });
  }

  function handleSaveAllFavoritesToLibrary() {
    favorites.forEach((item) => saveToLibrary(item.dua, item.nameOfAllah));
    setLibrary(getLibrary());
    setFavorites([]);
    setFavoritesState([]);
  }

  function getShareableDuaListText(): string {
    const lines: string[] = ["My du'a list — Du'aOS", ""];
    [...favorites].reverse().forEach((item) => {
      lines.push(item.dua);
      if (item.nameOfAllah) lines.push(`— ${item.nameOfAllah}`);
      lines.push("");
    });
    [...library].reverse().forEach((entry) => {
      lines.push(entry.dua);
      if (entry.name) lines.push(`— ${entry.name}`);
      lines.push("");
    });
    return lines.join("\n").trim();
  }

  async function handleShareDuaList() {
    const text = getShareableDuaListText();
    if (!text) return;
    setListShareFeedback(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "My du'a list",
          text,
        });
        setListShareFeedback("shared");
      } else {
        await navigator.clipboard.writeText(text);
        setListShareFeedback("copied");
      }
      setTimeout(() => setListShareFeedback(null), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setListShareFeedback("copied");
        setTimeout(() => setListShareFeedback(null), 2000);
      } catch {
        setListShareFeedback(null);
      }
    }
  }

  async function handleExportToNotes() {
    const text = getShareableDuaListText();
    if (!text) return;
    setExportToNotesFeedback(null);
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], "duaos-duas.txt", { type: "text/plain" });
    try {
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My du'as", text: "Du'aOS library" });
        setExportToNotesFeedback("Shared — pick Notes to save");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "duaos-duas.txt";
        a.click();
        URL.revokeObjectURL(a.href);
        setExportToNotesFeedback("Downloaded");
      }
    } catch {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "duaos-duas.txt";
      a.click();
      URL.revokeObjectURL(a.href);
      setExportToNotesFeedback("Downloaded");
    }
    setTimeout(() => setExportToNotesFeedback(null), 3000);
  }

  function handleShareForDuaOS() {
    const json = exportLibraryAsDuaOSJson(library, favorites);
    if (!json) return;
    setShareForDuaOSFeedback(null);
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], "duaos-library.json", { type: "application/json" });
    try {
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: "DuaOS library", text: "Send to another DuaOS user to import into their library." }).then(() => {
          setShareForDuaOSFeedback("Shared");
        }).catch(() => {
          navigator.clipboard.writeText(json).then(() => setShareForDuaOSFeedback("Copied"));
        });
      } else {
        navigator.clipboard.writeText(json).then(() => setShareForDuaOSFeedback("Copied — send to another user to import"));
      }
    } catch {
      navigator.clipboard.writeText(json).then(() => setShareForDuaOSFeedback("Copied — send to another user to import"));
    }
    setTimeout(() => setShareForDuaOSFeedback(null), 4000);
  }

  function handleCopyForDuaOS() {
    const one = { dua: refinedDua.trim(), name: searchResult?.name?.content, at: new Date().toISOString() };
    const json = JSON.stringify({ duaos: "library", version: DUAOS_EXPORT_VERSION, entries: [one] });
    navigator.clipboard.writeText(json).then(() => {
      setCopyFeedbackId("duaos-copy");
      setTimeout(() => setCopyFeedbackId(null), 2000);
    });
  }

  function handleImportConfirm() {
    setImportError(null);
    setImportSuccess(null);
    const raw = importInput.trim();
    const entries = parseDuaOSImport(raw);
    if (!entries || entries.length === 0) {
      setImportError("No valid du'as found. Paste DuaOS JSON or the shared text list.");
      return;
    }
    mergeIntoLibrary(entries);
    setLibrary(getLibrary());
    setImportSuccess(`Imported ${entries.length} du'a${entries.length === 1 ? "" : "s"}`);
    setImportInput("");
    setTimeout(() => {
      setImportSuccess(null);
      setImportModalOpen(false);
    }, 2000);
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setImportInput(text);
      setImportError(null);
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  function openShareModal() {
    sharePngRef.current = null;
    setShareError(null);
    setShareModalStep("intention");
    setShareModalOpen(true);
  }

  async function generateSharePng(): Promise<string | null> {
    const text = refinedDua.trim();
    if (!text || !shareCardRef.current) return null;
    if (sharePngRef.current) return sharePngRef.current;
    setIsSharing(true);
    const el = shareCardRef.current;
    const prevVisibility = el.style.visibility;
    try {
      el.style.visibility = "visible";
      await new Promise((r) => setTimeout(r, 100));
      const dataUrl = await toPng(el, {
        width: 1080,
        height: 1080,
        pixelRatio: 2,
        cacheBust: true,
      });
      sharePngRef.current = dataUrl;
      return dataUrl;
    } catch (e) {
      console.error("Share PNG failed:", e);
      setShareError("Image generation failed. Try downloading or sharing the text instead.");
      return null;
    } finally {
      el.style.visibility = prevVisibility;
      setIsSharing(false);
    }
  }

  async function handleShareContinueToOptions() {
    setShareError(null);
    await generateSharePng();
    setShareModalStep("options");
  }

  function shareToTwitter() {
    const text = refinedDua.trim();
    if (!text) return;
    const tweetText = `${text.slice(0, 250)}${text.length > 250 ? "…" : ""} — Du'aOS`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, "_blank", "noopener,noreferrer");
  }

  async function shareDownload() {
    const dataUrl = sharePngRef.current || (await generateSharePng());
    if (!dataUrl) {
      setShareError("Couldn't generate image. Try again.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "duaos-dua.png";
    a.click();
  }

  async function shareToMessage() {
    const dataUrl = sharePngRef.current || (await generateSharePng());
    if (!dataUrl) {
      setShareError("Couldn't generate image. Try again.");
      return;
    }
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "duaos-dua.png", { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My du'a",
          text: "Made with Du'aOS",
        });
      } else {
        await navigator.clipboard.writeText(refinedDua.trim());
        setShareError("Copied text to clipboard (image share not supported on this device).");
      }
    } catch {
      await navigator.clipboard.writeText(refinedDua.trim());
      setShareError("Copied text to clipboard (image share not supported on this device).");
    }
  }

  async function toggleVoiceInput() {
    setTranscribeError(null);
    if (isRecording) {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size === 0) return;
        try {
          const form = new FormData();
          form.append("file", blob, "recording.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setTranscribeError(data.error ?? "Transcription failed.");
            return;
          }
          if (typeof data.text === "string" && data.text.trim()) {
            setQuery((q) => (q ? `${q} ${data.text.trim()}` : data.text.trim()));
          }
        } catch (e) {
          console.error(e);
          setTranscribeError("Transcription failed. Check your connection.");
        }
      };
      rec.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setTranscribeError("Microphone access denied or unavailable.");
    }
  }

  const hadithEdition = searchResult?.hadith?.metadata?.edition;
  const hadithSourceLabel =
    typeof hadithEdition === "string" ? HADITH_EDITION_LABELS[hadithEdition] ?? hadithEdition : null;

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 flex flex-col">
      {sourcesPopupOpen && searchResult !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
          aria-labelledby="sources-popup-title"
          onClick={() => setSourcesPopupOpen(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-t-2xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-6 shadow-[0_4px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)] max-h-[85dvh] flex flex-col backdrop-blur-xl pt-[env(safe-area-inset-top)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSourcesPopupOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="size-6 text-emerald-600 shrink-0" aria-hidden />
              <h2 id="sources-popup-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 font-github">
                Verified sources
              </h2>
            </div>
            <div className="overflow-y-auto pr-1 space-y-3">
              {searchResult.name && (
                <p className="text-sm text-slate-700 dark:text-slate-300 font-github">
                  <span className="text-emerald-600 dark:text-emerald-400">Name of Allah:</span> {searchResult.name.content}
                </p>
              )}
              {(() => {
                const popupHadiths = (searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])).filter(
                  (h) => typeof h.metadata?.reference === "string" && h.metadata.reference.trim() !== ""
                );
                return popupHadiths.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-emerald-600 font-github not-italic text-sm">
                    Hadith (by relevance) - {popupHadiths.length}
                  </p>
                  {popupHadiths.map((h, i) => {
                    const reference = typeof h.metadata?.reference === "string" ? h.metadata.reference : "";
                    const label = [hadithSourceLabel, reference].filter(Boolean).join(" — ");
                    const sourceKey = `hadith-${h.id ?? i}`;
                    const hasArabic = isArabicText(h.content);
                    return (
                      <details
                        key={h.id ?? i}
                        className="group rounded-lg border border-slate-200/60 dark:border-slate-500/30 bg-slate-50/80 dark:bg-slate-800/50 open:bg-slate-100/80 dark:open:bg-slate-700/50 transition-colors"
                      >
                        <summary className="list-none cursor-pointer px-3 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-github">Hadith #{i + 1}</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-github truncate">
                              {label || h.content.slice(0, 80)}
                            </p>
                          </div>
                          <ChevronDown className="size-4 text-slate-400 dark:text-slate-500 transition-transform group-open:rotate-180 shrink-0" />
                        </summary>
                        <div className="px-3 pb-3">
                          <p className="text-sm text-slate-800 dark:text-slate-200 font-calligraphy whitespace-pre-wrap">{h.content}</p>
                          {hasArabic && (
                            <div className="mt-2">
                              {!sourceTranslations[sourceKey] && (
                                <button
                                  type="button"
                                  onClick={() => void ensureSourceTranslation(sourceKey, h.content)}
                                  className="text-xs font-github text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                                >
                                  {translatingSource[sourceKey] ? "Translating..." : "Show English translation"}
                                </button>
                              )}
                              {sourceTranslations[sourceKey] && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 font-github italic mt-1">
                                  {sourceTranslations[sourceKey]}
                                </p>
                              )}
                            </div>
                          )}
                          {label && <p className="text-xs text-slate-500 font-github mt-1.5">{label}</p>}
                        </div>
                      </details>
                    );
                  })}
                </div>
                ) : <p className="text-sm text-slate-500 dark:text-slate-400 font-github">No hadith match with reference.</p>;
              })()}
              {searchResult.quran?.content && (typeof searchResult.quran?.metadata?.reference === "string" || typeof searchResult.quran?.metadata?.surah === "string") ? (
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-github font-calligraphy">
                    <span className="text-emerald-600 dark:text-emerald-400 font-github not-italic">Quran:</span> {searchResult.quran.content}
                  </p>
                  {(() => {
                    const key = `quran-${searchResult.quran.id ?? searchResult.quran.metadata?.reference ?? "current"}`;
                    const hasArabic = isArabicText(searchResult.quran.content);
                    if (!hasArabic) return null;
                    return (
                      <div className="mt-1">
                        {!sourceTranslations[key] && (
                          <button
                            type="button"
                            onClick={() => void ensureSourceTranslation(key, searchResult.quran?.content ?? "")}
                            className="text-xs font-github text-emerald-300 hover:text-emerald-200"
                          >
                            {translatingSource[key] ? "Translating..." : "Show English translation"}
                          </button>
                        )}
                        {sourceTranslations[key] && (
                          <p className="text-sm text-slate-600 font-github italic mt-1">
                            {sourceTranslations[key]}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {(typeof searchResult.quran.metadata?.surah === "string" || typeof searchResult.quran.metadata?.reference === "string") ? (
                    <p className="text-xs text-slate-500 font-github mt-0.5">
                      {typeof searchResult.quran.metadata?.surah === "string" ? searchResult.quran.metadata.surah : ""}{searchResult.quran.metadata?.surah && searchResult.quran.metadata?.reference ? " " : ""}{typeof searchResult.quran.metadata?.reference === "string" ? searchResult.quran.metadata.reference : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 font-github">No Quran verse match with citation.</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-github border-t border-slate-200/60 dark:border-slate-500/30 pt-3">
                DuaOS connects your intention to verified sources: Names of Allah, hadith, and the Qur&apos;an (The Noble Quran, English).
              </p>
              {refinedDua ? (
                <div className="border-t border-slate-200/60 dark:border-slate-500/30 pt-3 mt-3">
                  <p className="text-emerald-600 dark:text-emerald-400 font-github not-italic text-sm mb-2">Refined du&apos;a</p>
                  <div className="text-sm text-slate-800 dark:text-slate-200 font-calligraphy leading-relaxed">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 text-sm">{children}</p>,
                        h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-medium mt-2 mb-1">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                      }}
                    >
                      {refinedDua}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex gap-2">
              {!refinedDua && (
                <Button
                  className="flex-1 font-github border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSourcesPopupOpen(false);
                    void handleRefine();
                  }}
                  disabled={isRefining}
                >
                  {isRefining ? "Refining…" : "Refine into du'a"}
                </Button>
              )}
              <Button
                className={`font-github ${refinedDua ? "w-full" : "flex-1"}`}
                variant="outline"
                size="sm"
                onClick={() => setSourcesPopupOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal — center, intention check then options */}
      {shareModalOpen && refinedDua && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
          aria-label="Share du'a"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-6 shadow-[0_4px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)] max-h-[85dvh] overflow-y-auto backdrop-blur-xl pt-[env(safe-area-inset-top)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>

            {shareModalStep === "intention" && (
              <>
                <div className="rounded-xl border-2 border-red-500/50 bg-red-950/40 p-4 mb-6">
                  <p className="text-sm font-github text-red-200/95 leading-relaxed">
                    Hey, check your intentions. Make sure you&apos;re not being performative or showing off.
                  </p>
                </div>
                <Button
                  className="w-full font-github"
                  onClick={() => void handleShareContinueToOptions()}
                  disabled={isSharing}
                >
                  {isSharing ? "Preparing…" : "I've reflected — continue"}
                </Button>
              </>
            )}

            {shareModalStep === "options" && (
              <>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 font-github mb-4">Share</h3>
                {shareError && (
                  <p className="mb-3 text-sm text-red-200/95 font-github">{shareError}</p>
                )}
                <div className="flex flex-col gap-2">
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={shareToTwitter}
                    >
                      Twitter
                    </Button>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-github text-center">(text only)</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-github border-slate-200/80 text-slate-700 justify-center hover:bg-slate-100"
                    onClick={() => void shareDownload()}
                  >
                    Instagram
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-github border-slate-200/80 text-slate-700 justify-center hover:bg-slate-100"
                    onClick={() => void shareToMessage()}
                  >
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-github border-slate-200/80 text-slate-700 justify-center hover:bg-slate-100"
                    onClick={() => void shareDownload()}
                  >
                    Download
                  </Button>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-github text-center">
                  Instagram: download image, then post from your gallery.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Favorites & Library — slide-out from the right */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${favoritesPanelOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden
        onClick={() => setFavoritesPanelOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col border-l border-slate-200/60 dark:border-slate-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.08)] dark:shadow-[0_0_40px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] ${favoritesPanelOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Favorites and Library"
        aria-hidden={!favoritesPanelOpen}
      >
            <div className="flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-200/60 dark:border-slate-500/30 px-3 py-3 sm:px-4 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-github uppercase tracking-wider">
                Favorites & Library
              </h2>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  aria-label="Import library"
                >
                  Import
                </button>
                {favorites.length + library.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleExportToNotes()}
                      className="text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      aria-label="Export to Notes"
                    >
                      {exportToNotesFeedback || "Export to Notes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareForDuaOS()}
                      className="text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      aria-label="Share for DuaOS import"
                    >
                      {shareForDuaOSFeedback || "Share for DuaOS"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShareDuaList()}
                      className="text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      aria-label="Share my du'a list"
                    >
                      {listShareFeedback === "shared" ? "Shared" : listShareFeedback === "copied" ? "Copied" : "Share list"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setFavoritesPanelOpen(false)}
                  className="rounded-full p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8">
              {/* Favorites */}
              <section aria-label="Favorites">
                <h3 className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider font-github">Favorites</h3>
                {favorites.length === 0 ? (
                  <p className="text-sm text-slate-500 font-github">Refined du'as you add will appear here as reminders.</p>
                ) : (
                  <>
                    <Button
                      className="mb-4 w-full font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSaveAllFavoritesToLibrary();
                        setFavoritesPanelOpen(false);
                      }}
                    >
                      Save all to Library
                    </Button>
                    <ul className="space-y-4">
                      {[...favorites].reverse().map((item) => (
                        <li key={item.id} className="rounded-lg border border-slate-200/60 dark:border-slate-500/30 bg-slate-50/80 dark:bg-slate-800/50 p-3">
                          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 font-calligraphy leading-relaxed">{item.dua}</p>
                          {item.nameOfAllah && (
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-github">— {item.nameOfAllah}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddDuaToFavorites({ dua: item.dua, nameOfAllah: item.nameOfAllah, hadithSnippet: item.hadithSnippet })}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
                              aria-label="Add to favorites"
                            >
                              <Plus className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyDua(item.dua, item.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label="Copy"
                            >
                              <Copy className="size-3.5" />
                              {copyFeedbackId === item.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveFromFavorites(item)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label="Save to Library"
                            >
                              Save to Library
                            </button>
                            <button
                              type="button"
                              onClick={() => setFavoritesState(removeFromFavorites(item.id))}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                              aria-label="Remove"
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              {/* Personal Library */}
              <section aria-label="Personal Library">
                <h3 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-github">Personal Library</h3>
                {library.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-github">Du'as you save to the library will appear here.</p>
                ) : (
                  <ul className="space-y-4">
                    {[...library].reverse().map((entry, i) => {
                      const entryId = `library-${entry.at}-${i}`;
                      return (
                        <li key={entryId} className="rounded-lg border border-slate-200/60 dark:border-slate-500/30 bg-slate-50/80 dark:bg-slate-800/50 p-3">
                          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 font-calligraphy leading-relaxed">{entry.dua}</p>
                          {entry.name && (
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-github">— {entry.name}</p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddDuaToFavorites({ dua: entry.dua, nameOfAllah: entry.name })}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
                              aria-label="Add to favorites"
                            >
                              <Plus className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyDua(entry.dua, entryId)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label="Copy"
                            >
                              <Copy className="size-3.5" />
                              {copyFeedbackId === entryId ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromLibrary(entry)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                              aria-label="Remove from library"
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </button>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-github">
                              {new Date(entry.at).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </aside>

      <Header
        favoritesCount={favorites.length}
        onCartClick={() => setFavoritesPanelOpen(true)}
      />
      <main className="flex-1 flex flex-col items-center justify-center mx-auto max-w-2xl w-full px-4 py-8 sm:py-12 pt-28 sm:pt-36 pb-[env(safe-area-inset-bottom)]">
        <KofiBanner />
        <h1 className="font-serif text-xl sm:text-2xl text-slate-800 dark:text-slate-100 text-center mb-4 sm:mb-6 leading-relaxed mt-2 sm:mt-4 px-1">
          What do you want to make du'a for today?
        </h1>
        <div className="group w-full flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-500/40 bg-white/90 dark:bg-slate-800/60 px-4 py-3 min-h-[52px] backdrop-blur-xl transition-all duration-200 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.3)] hover:border-emerald-400/40 dark:hover:border-emerald-500/50">
          <div className="flex-1 min-w-0 relative flex items-center">
            <input
              type="text"
              placeholder=" "
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full bg-transparent text-slate-800 dark:text-slate-200 text-sm sm:text-base font-calligraphy outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 py-1"
            />
            {!query && (
              <div
                className="absolute inset-0 flex items-center pointer-events-none text-slate-500 font-calligraphy text-sm sm:text-base transition-opacity ease-in-out "
                style={{
                  opacity: placeholderVisible ? 1 : 0,
                  transitionDuration: `${PLACEHOLDER_FADE_MS}ms`,
                }}
                aria-hidden
              >
                {INPUT_SUGGESTIONS[suggestionIndex]}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap sm:flex-nowrap">
            <div className="relative flex items-center font-github text-sm min-w-0">
              <select
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                className="appearance-none bg-transparent pr-5 py-1 outline-none cursor-pointer text-slate-700 dark:text-slate-300 text-sm min-w-0 max-w-[140px]"
                aria-label="Hadith book"
              >
                <option value="">{HADITH_EDITION_LABELS[""]}</option>
                {availableEditions.map((e) => (
                  <option key={e} value={e} className="font-black">
                    {HADITH_EDITION_LABELS[e] ?? e}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 size-3.5 pointer-events-none text-slate-400 dark:text-slate-500 shrink-0" aria-hidden />
            </div>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`shrink-0 rounded-md transition-colors p-2 border border-slate-200/80 dark:border-slate-500/50 ${isRecording ? "text-red-600 bg-red-500/10" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              aria-label={isRecording ? "Stop recording" : "Voice input"}
            >
              <Mic className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={isSearching}
              className="hidden sm:inline-flex shrink-0 p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 rounded-md transition-colors disabled:opacity-50"
              aria-label="Search"
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
        {transcribeError && (
          <p className="mt-2 text-center text-sm text-amber-600 dark:text-amber-400 font-github">{transcribeError}</p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {INPUT_SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setQuery(text)}
              className="rounded-full border border-slate-200/80 dark:border-slate-500/50 bg-white/80 dark:bg-slate-800/60 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 font-github shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300/80 dark:hover:border-slate-500/60 transition-colors"
            >
              {text}
            </button>
          ))}
        </div>
        <a
          href={MUHIB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-500/50 bg-white/80 dark:bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400/40 dark:hover:border-emerald-500/50 font-github backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] transition-colors duration-200"
        >
          <span>Built by</span>
          <Image
            src="/muhib.png"
            alt="Muhib"
            width={24}
            height={24}
            className="rounded-full object-cover ring-2 ring-zinc-500/30"
          />
        </a>
      </main>

      {/* Results below the centered block */}
      <div className="mx-auto max-w-2xl w-full px-4 pb-[max(3rem,env(safe-area-inset-bottom))]">
        {searchError && (
          <p className="mt-6 text-center text-sm text-amber-300/90 font-github">{searchError}</p>
        )}
        {searchResult !== null && (
          <section className="mt-8 w-full rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-slate-50/95 dark:bg-slate-800/60 backdrop-blur-xl p-4 sm:p-5 text-slate-800 dark:text-slate-200 font-github shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]">
            <h2 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">From search</h2>
            {searchResult.name && (
              <p className="mb-2">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Name of Allah:</span> <span className="font-calligraphy text-slate-800 dark:text-slate-200">{searchResult.name.content}</span>
              </p>
            )}
            {(() => {
              const hadithList = (searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])).filter(
                (h) => typeof h.metadata?.reference === "string" && h.metadata.reference.trim() !== ""
              );
              return hadithList.length > 0 ? (
                <div className="mb-2 space-y-2">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Hadith (by relevance)</span>
                  {hadithList.slice(0, 3).map((h, i) => (
                    <p key={h.id ?? i} className="font-calligraphy text-slate-800 dark:text-slate-200">
                      {h.content}
                      <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({typeof h.metadata?.reference === "string" ? h.metadata.reference : ""})</span>
                    </p>
                  ))}
                  {hadithList.length > 3 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Also relevant: {hadithList.slice(3).map((h) => h.metadata?.reference).join(", ")}
                    </p>
                  )}
                </div>
              ) : null;
            })()}
            {searchResult.quran?.content && (typeof searchResult.quran.metadata?.reference === "string" || typeof searchResult.quran.metadata?.surah === "string") && (
              <div className="mb-2">
                <p className="font-calligraphy">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Quran:</span> {searchResult.quran.content}
                  <span className="ml-1 text-xs text-slate-500">
                    ({typeof searchResult.quran.metadata?.surah === "string" ? searchResult.quran.metadata.surah : ""} {typeof searchResult.quran.metadata?.reference === "string" ? searchResult.quran.metadata.reference : ""})
                  </span>
                </p>
                {(() => {
                  const key = `quran-${searchResult.quran?.id ?? searchResult.quran?.metadata?.reference ?? "current"}`;
                  if (!searchResult.quran?.content || !isArabicText(searchResult.quran.content)) return null;
                  return sourceTranslations[key] ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic mt-1 font-github">{sourceTranslations[key]}</p>
                  ) : null;
                })()}
              </div>
            )}
            {!searchResult.name &&
              !(searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])).some((h) => typeof h.metadata?.reference === "string" && h.metadata.reference.trim() !== "") &&
              !(searchResult.quran?.content && (searchResult.quran.metadata?.reference || searchResult.quran.metadata?.surah)) && (
              <p className="mb-2 text-slate-500 dark:text-slate-400 text-sm">No matching sources found; you can still refine your intention into a du'a.</p>
            )}
            {usedFailsafe && (
              <p className="mt-2 text-xs text-slate-500 font-github">Matched using online search.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                variant="outline"
                size="sm"
                onClick={() => void handleRefine()}
                disabled={isRefining}
              >
                {isRefining ? "Refining…" : "Refine into du'a"}
              </Button>
              <Button
                className="font-github border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                variant="outline"
                size="sm"
                onClick={() => {
                  const parts = [
                    searchResult.hadith?.content,
                    searchResult.quran?.content,
                  ].filter(Boolean);
                  if (parts.length === 0 && searchResult.name) parts.push(searchResult.name.content);
                  if (parts.length === 0) return;
                  addToFavorites({
                    dua: parts.join("\n\n"),
                    nameOfAllah: searchResult.name?.content,
                    hadithSnippet: searchResult.hadith?.content,
                  });
                  setFavoritesState(getFavorites());
                }}
              >
                Add to favorites
              </Button>
            </div>
          </section>
        )}

        {refinedDua && (
          <>
            <div
              ref={shareCardRef}
              className="fixed left-0 top-0 w-[1080px] h-[1080px] overflow-hidden pointer-events-none invisible -z-10"
              aria-hidden
            >
              <DuaShareCard
                personalDua={extractPersonalDua(refinedDua.trim())}
                hadithSources={
                  (searchResult?.hadiths ?? [])
                    .filter((h) => typeof h.metadata?.reference === "string" && (h.metadata.reference as string).trim() !== "")
                    .slice(0, 8)
                    .map((h) => {
                      const edition = typeof h.metadata?.edition === "string" ? (HADITH_EDITION_LABELS[h.metadata.edition] ?? h.metadata.edition) : "";
                      const ref = typeof h.metadata?.reference === "string" ? h.metadata.reference : "";
                      return [edition, ref].filter(Boolean).join(" — ");
                    })
                }
              />
            </div>
            <section className="mt-6 w-full rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-slate-50/95 dark:bg-slate-800/60 backdrop-blur-xl p-4 sm:p-5 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]">
              <h2 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-github">Refined du'a</h2>
              {query.trim() && (
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 font-github italic">From: &ldquo;{query.trim()}&rdquo;</p>
              )}
              <div
                ref={refinedContentRef}
                onMouseUp={updateRefinedSelection}
                onKeyUp={updateRefinedSelection}
                className="rounded-xl bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-600/40 p-4 sm:p-5 text-slate-800 dark:text-slate-200 font-calligraphy text-lg refined-dua-markdown"
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2 first:mt-0 text-slate-800 dark:text-slate-100">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-medium mt-3 mb-1.5 text-slate-800 dark:text-slate-100">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                  }}
                >
                  {refinedDua}
                </ReactMarkdown>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="font-github border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10"
                  variant="outline"
                  size="sm"
                  onClick={handleAddToFavorites}
                >
                  <Plus className="size-4 mr-1 inline" />
                  Add to favorites
                </Button>
                <Button
                  className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveToLibrary}
                  disabled={saved}
                >
                  {saved ? "Saved to Library" : "Save to Library"}
                </Button>
                <Button
                  className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSelectionToLibrary}
                  disabled={!selectedRefinedText}
                >
                  {savedSelectionFeedback ? "Saved selection to Library" : "Save selection to Library"}
                </Button>
                <Button
                  className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  variant="outline"
                  size="sm"
                  onClick={openShareModal}
                  aria-label="Share as image"
                >
                  <Share2 className="size-4 mr-1 inline" />
                  Share
                </Button>
                <Button
                  className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyForDuaOS}
                  aria-label="Copy for DuaOS import"
                >
                  {copyFeedbackId === "duaos-copy" ? "Copied" : "Copy for DuaOS"}
                </Button>
              </div>
            </section>
          </>
        )}

      </div>

      {/* Import modal */}
      {importModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
          aria-labelledby="import-modal-title"
          onClick={() => !importSuccess && setImportModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-6 shadow-[0_4px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)] max-h-[85dvh] overflow-y-auto backdrop-blur-xl pt-[env(safe-area-inset-top)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !importSuccess && setImportModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <h2 id="import-modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 font-github mb-2">
              Import to Library
            </h2>
            <p className="text-sm text-slate-400 font-github mb-3">
              Paste shared DuaOS JSON or text list, or choose a file. Du'as will be merged into your library.
            </p>
            <textarea
              value={importInput}
              onChange={(e) => { setImportInput(e.target.value); setImportError(null); }}
              placeholder='Paste here or use "Choose file" below...'
              className="w-full h-32 rounded-lg border border-slate-200/80 bg-slate-50/80 text-slate-800 font-github text-sm p-3 resize-y placeholder:text-slate-500"
              aria-label="Paste import content"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,application/json,text/plain"
              onChange={handleImportFileChange}
              className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-github file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-emerald-500/20 file:text-emerald-700 dark:file:text-emerald-300"
              aria-label="Choose file to import"
            />
            {importError && <p className="mt-2 text-sm text-red-300 font-github">{importError}</p>}
            {importSuccess && <p className="mt-2 text-sm text-emerald-300 font-github">{importSuccess}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                className="font-github flex-1"
                onClick={handleImportConfirm}
                disabled={!importInput.trim()}
              >
                Import
              </Button>
              <Button
                className="font-github"
                variant="outline"
                size="sm"
                onClick={() => { setImportModalOpen(false); setImportInput(""); setImportError(null); setImportSuccess(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
