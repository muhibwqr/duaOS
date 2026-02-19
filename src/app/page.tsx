"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { ArrowRight, CheckCircle2, ChevronDown, Copy, Mic, Plus, Share2, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { KofiBanner } from "@/components/KofiBanner";
import { Button } from "@/components/ui/button";
import { DuaShareCard } from "@/components/DuaShareCard";
import { HADITH_EDITIONS, HADITH_EDITION_LABELS, MAX_HADITH_CONTEXT_LENGTH } from "@/lib/validation";
import { localMatch } from "@/lib/local-match";
import namesOfAllah from "@/data/names-of-allah.json";

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
  const [voiceArabic, setVoiceArabic] = useState(false);
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
  const [edition, setEdition] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const s = localStorage.getItem(HADITH_EDITION_STORAGE_KEY);
      return s && (s === "" || HADITH_EDITIONS.includes(s as (typeof HADITH_EDITIONS)[number])) ? s : "";
    } catch {
      return "";
    }
  });
  const [availableEditions, setAvailableEditions] = useState<string[]>([]);

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
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 2,
        cacheBust: true,
      });
      sharePngRef.current = dataUrl;
      return dataUrl;
    } catch (e) {
      console.error("Share PNG failed:", e);
      return null;
    } finally {
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
          if (voiceArabic) form.append("language", "ar");
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
    <div className="min-h-screen bg-transparent text-slate-200 flex flex-col">
      {sourcesPopupOpen && searchResult !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
          aria-labelledby="sources-popup-title"
          onClick={() => setSourcesPopupOpen(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl border border-slate-500/30 bg-slate-900/95 p-6 shadow-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSourcesPopupOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="size-6 text-emerald-400 shrink-0" aria-hidden />
              <h2 id="sources-popup-title" className="text-lg font-semibold text-slate-100 font-github">
                Verified sources
              </h2>
            </div>
            <div className="overflow-y-auto pr-1 space-y-3">
              {searchResult.name && (
                <p className="text-sm text-slate-300 font-github">
                  <span className="text-emerald-400/90">Name of Allah:</span> {searchResult.name.content}
                </p>
              )}
              {(() => {
                const popupHadiths = (searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])).filter(
                  (h) => typeof h.metadata?.reference === "string" && h.metadata.reference.trim() !== ""
                );
                return popupHadiths.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-emerald-400/90 font-github not-italic text-sm">
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
                        className="group rounded-lg border border-slate-500/20 bg-slate-800/40 open:bg-slate-800/70 transition-colors"
                      >
                        <summary className="list-none cursor-pointer px-3 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-400 font-github">Hadith #{i + 1}</p>
                            <p className="text-sm text-slate-300 font-github truncate">
                              {label || h.content.slice(0, 80)}
                            </p>
                          </div>
                          <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                        </summary>
                        <div className="px-3 pb-3">
                          <p className="text-sm text-slate-200 font-calligraphy whitespace-pre-wrap">{h.content}</p>
                          {hasArabic && (
                            <div className="mt-2">
                              {!sourceTranslations[sourceKey] && (
                                <button
                                  type="button"
                                  onClick={() => void ensureSourceTranslation(sourceKey, h.content)}
                                  className="text-xs font-github text-emerald-300 hover:text-emerald-200"
                                >
                                  {translatingSource[sourceKey] ? "Translating..." : "Show English translation"}
                                </button>
                              )}
                              {sourceTranslations[sourceKey] && (
                                <p className="text-sm text-slate-300 font-github italic mt-1">
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
                ) : <p className="text-sm text-slate-500 font-github">No hadith match with reference.</p>;
              })()}
              {searchResult.quran?.content && (typeof searchResult.quran?.metadata?.reference === "string" || typeof searchResult.quran?.metadata?.surah === "string") ? (
                <div>
                  <p className="text-sm text-slate-300 font-github font-calligraphy">
                    <span className="text-emerald-400/90 font-github not-italic">Quran:</span> {searchResult.quran.content}
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
                          <p className="text-sm text-slate-300 font-github italic mt-1">
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
                <p className="text-sm text-slate-500 font-github">No Quran verse match with citation.</p>
              )}
              <p className="text-xs text-slate-500 font-github border-t border-slate-500/20 pt-3">
                DuaOS connects your intention to verified sources: Names of Allah, hadith, and the Qur&apos;an (The Noble Quran, English).
              </p>
            </div>
            <Button
              className="mt-4 w-full font-github"
              variant="outline"
              size="sm"
              onClick={() => setSourcesPopupOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Share modal — center, intention check then options */}
      {shareModalOpen && refinedDua && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
          aria-label="Share du'a"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-500/30 bg-slate-900/95 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5"
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
                <h3 className="text-sm font-medium text-slate-300 font-github mb-4">Share</h3>
                {shareError && (
                  <p className="mb-3 text-sm text-red-200/95 font-github">{shareError}</p>
                )}
                <div className="flex flex-col gap-2">
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-github border-slate-500/40 text-slate-200 justify-center"
                      onClick={shareToTwitter}
                    >
                      Twitter
                    </Button>
                    <p className="mt-1 text-xs text-slate-500 font-github text-center">(text only)</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-github border-slate-500/40 text-slate-200 justify-center"
                    onClick={() => void shareDownload()}
                  >
                    Instagram
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-github border-slate-500/40 text-slate-200 justify-center"
                    onClick={() => void shareToMessage()}
                  >
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-github border-slate-500/40 text-slate-200 justify-center"
                    onClick={() => void shareDownload()}
                  >
                    Download
                  </Button>
                </div>
                <p className="mt-3 text-xs text-slate-500 font-github text-center">
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
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col border-l border-slate-500/30 bg-slate-900/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out ${favoritesPanelOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Favorites and Library"
        aria-hidden={!favoritesPanelOpen}
      >
            <div className="flex items-center justify-between gap-4 border-b border-slate-500/20 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-100 font-github uppercase tracking-wider">
                Favorites & Library
              </h2>
              <div className="flex items-center gap-2">
                {favorites.length + library.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleShareDuaList()}
                    className="text-xs font-github text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Share my du'a list"
                  >
                    {listShareFeedback === "shared" ? "Shared" : listShareFeedback === "copied" ? "Copied" : "Share list"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFavoritesPanelOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
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
                      className="mb-4 w-full font-github border-slate-500/40 text-slate-200 hover:bg-white/5"
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
                        <li key={item.id} className="rounded-lg border border-slate-500/20 bg-slate-800/40 p-3">
                          <p className="whitespace-pre-wrap text-sm text-slate-100 font-calligraphy leading-relaxed">{item.dua}</p>
                          {item.nameOfAllah && (
                            <p className="mt-1.5 text-xs text-slate-500 font-github">— {item.nameOfAllah}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddDuaToFavorites({ dua: item.dua, nameOfAllah: item.nameOfAllah, hadithSnippet: item.hadithSnippet })}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              aria-label="Add to favorites"
                            >
                              <Plus className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyDua(item.dua, item.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-slate-200 hover:bg-white/5"
                              aria-label="Copy"
                            >
                              <Copy className="size-3.5" />
                              {copyFeedbackId === item.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveFromFavorites(item)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-slate-200 hover:bg-white/5"
                              aria-label="Save to Library"
                            >
                              Save to Library
                            </button>
                            <button
                              type="button"
                              onClick={() => setFavoritesState(removeFromFavorites(item.id))}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-red-300 hover:bg-red-500/10"
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
                <h3 className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider font-github">Personal Library</h3>
                {library.length === 0 ? (
                  <p className="text-sm text-slate-500 font-github">Du'as you save to the library will appear here.</p>
                ) : (
                  <ul className="space-y-4">
                    {[...library].reverse().map((entry, i) => {
                      const entryId = `library-${entry.at}-${i}`;
                      return (
                        <li key={entryId} className="rounded-lg border border-slate-500/20 bg-slate-800/40 p-3">
                          <p className="whitespace-pre-wrap text-sm text-slate-100 font-calligraphy leading-relaxed">{entry.dua}</p>
                          {entry.name && (
                            <p className="mt-1.5 text-xs text-slate-500 font-github">— {entry.name}</p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddDuaToFavorites({ dua: entry.dua, nameOfAllah: entry.name })}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              aria-label="Add to favorites"
                            >
                              <Plus className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyDua(entry.dua, entryId)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-slate-200 hover:bg-white/5"
                              aria-label="Copy"
                            >
                              <Copy className="size-3.5" />
                              {copyFeedbackId === entryId ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromLibrary(entry)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 hover:text-red-300 hover:bg-red-500/10"
                              aria-label="Remove from library"
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </button>
                            <p className="text-xs text-slate-500 font-github">
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
      <main className="flex-1 flex flex-col items-center justify-center mx-auto max-w-2xl w-full px-4 py-12 pt-36">
        <KofiBanner />
        <h1 className="font-serif text-2xl text-slate-100 text-center mb-6 leading-relaxed mt-4">
          What do you want to make du'a for today?
        </h1>
        <div className="group w-full flex items-end gap-2 rounded-2xl border border-slate-500/30 bg-slate-800/50 px-4 py-3 min-h-[52px] backdrop-blur-xl transition-all duration-300 shadow-[0_0_32px_rgba(5,150,105,0.12)] hover:border-emerald-500/20 hover:shadow-[0_0_40px_rgba(5,150,105,0.18)]">
          <div className="flex-1 min-w-0 relative flex items-center">
            <input
              type="text"
              placeholder=" "
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full bg-transparent text-slate-100 text-base font-calligraphy outline-none placeholder:text-slate-500 py-1"
            />
            {!query && (
              <div
                className="absolute inset-0 flex items-center pointer-events-none text-slate-500 font-calligraphy text-base transition-opacity ease-in-out"
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
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative flex items-center font-github text-sm">
              <select
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                className="appearance-none bg-transparent pr-5 py-1 outline-none cursor-pointer text-slate-200 text-sm min-w-0 max-w-[140px]"
                aria-label="Hadith book"
              >
                <option value="">{HADITH_EDITION_LABELS[""]}</option>
                {availableEditions.map((e) => (
                  <option key={e} value={e}>
                    {HADITH_EDITION_LABELS[e] ?? e}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 size-3.5 pointer-events-none text-slate-400 shrink-0" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => setVoiceArabic((v) => !v)}
              className={`shrink-0 px-2 py-1 rounded-md text-xs font-github transition-colors ${voiceArabic ? "text-emerald-300 bg-emerald-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
              aria-label={voiceArabic ? "Voice: Arabic" : "Voice: auto"}
              title={voiceArabic ? "Transcribe as Arabic (click to turn off)" : "Transcribe as Arabic (click for Arabic)"}
            >
              ع
            </button>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`shrink-0 rounded-md transition-colors p-2 ring-1 ring-emerald-500/40 ${isRecording ? "text-red-400 bg-red-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
              aria-label={isRecording ? "Stop recording" : "Voice input"}
            >
              <Mic className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={isSearching}
              className="shrink-0 p-1.5 text-emerald-400/90 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors disabled:opacity-50"
              aria-label="Search"
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
        {transcribeError && (
          <p className="mt-2 text-center text-sm text-amber-300/90 font-github">{transcribeError}</p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {INPUT_SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => setQuery(text)}
              className="rounded-full border border-slate-500/40 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-200 font-github hover:border-slate-400/50 hover:bg-slate-700/50 hover:text-slate-100 transition-colors"
            >
              {text}
            </button>
          ))}
        </div>
        <a
          href={MUHIB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 hover:text-slate-100 font-github backdrop-blur-xl transition-all duration-300 shadow-[0_0_28px_rgba(212,175,55,0.25)] hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:border-white/20"
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
      <div className="mx-auto max-w-2xl w-full px-4 pb-12">
        {searchError && (
          <p className="mt-6 text-center text-sm text-amber-300/90 font-github">{searchError}</p>
        )}
        {searchResult !== null && (
          <section className="mt-8 w-full rounded-xl border border-slate-500/20 bg-slate-900/30 backdrop-blur-xl p-4 text-slate-200 font-github shadow-[0_0_24px_rgba(5,150,105,0.04)]">
            <h2 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider">From search</h2>
            {searchResult.name && (
              <p className="mb-2">
                <span className="font-medium text-emerald-400/90">Name of Allah:</span> <span className="font-calligraphy">{searchResult.name.content}</span>
              </p>
            )}
            {(() => {
              const hadithList = (searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])).filter(
                (h) => typeof h.metadata?.reference === "string" && h.metadata.reference.trim() !== ""
              );
              return hadithList.length > 0 ? (
                <div className="mb-2 space-y-2">
                  <span className="font-medium text-emerald-400/90">Hadith (by relevance)</span>
                  {hadithList.slice(0, 3).map((h, i) => (
                    <p key={h.id ?? i} className="font-calligraphy">
                      {h.content}
                      <span className="ml-1 text-xs text-slate-500">({typeof h.metadata?.reference === "string" ? h.metadata.reference : ""})</span>
                    </p>
                  ))}
                  {hadithList.length > 3 && (
                    <p className="text-xs text-slate-500">
                      Also relevant: {hadithList.slice(3).map((h) => h.metadata?.reference).join(", ")}
                    </p>
                  )}
                </div>
              ) : null;
            })()}
            {searchResult.quran?.content && (typeof searchResult.quran.metadata?.reference === "string" || typeof searchResult.quran.metadata?.surah === "string") && (
              <div className="mb-2">
                <p className="font-calligraphy">
                  <span className="font-medium text-emerald-400/90">Quran:</span> {searchResult.quran.content}
                  <span className="ml-1 text-xs text-slate-500">
                    ({typeof searchResult.quran.metadata?.surah === "string" ? searchResult.quran.metadata.surah : ""} {typeof searchResult.quran.metadata?.reference === "string" ? searchResult.quran.metadata.reference : ""})
                  </span>
                </p>
                {(() => {
                  const key = `quran-${searchResult.quran?.id ?? searchResult.quran?.metadata?.reference ?? "current"}`;
                  if (!searchResult.quran?.content || !isArabicText(searchResult.quran.content)) return null;
                  return sourceTranslations[key] ? (
                    <p className="text-sm text-slate-300 italic mt-1 font-github">{sourceTranslations[key]}</p>
                  ) : null;
                })()}
              </div>
            )}
            {!searchResult.name &&
              !(searchResult.hadiths ?? (searchResult.hadith ? [searchResult.hadith] : [])).some((h) => typeof h.metadata?.reference === "string" && h.metadata.reference.trim() !== "") &&
              !(searchResult.quran?.content && (searchResult.quran.metadata?.reference || searchResult.quran.metadata?.surah)) && (
              <p className="mb-2 text-slate-500 text-sm">No matching sources found; you can still refine your intention into a du'a.</p>
            )}
            {usedFailsafe && (
              <p className="mt-2 text-xs text-slate-500 font-github">Matched using online search.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="font-github border-slate-500/40 text-slate-200 hover:bg-white/5"
                variant="outline"
                size="sm"
                onClick={() => void handleRefine()}
                disabled={isRefining}
              >
                {isRefining ? "Refining…" : "Refine into du'a"}
              </Button>
              <Button
                className="font-github border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30"
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
              className="fixed left-[-9999px] top-0 z-[-1]"
              aria-hidden
            >
              <DuaShareCard
                nameOfAllah={searchResult?.name?.content}
                refinedDua={refinedDua.trim()}
                verifiedSource={hadithSourceLabel ?? undefined}
              />
            </div>
            <section className="mt-6 w-full rounded-xl border border-slate-500/20 bg-slate-900/30 backdrop-blur-xl p-4 shadow-[0_0_24px_rgba(5,150,105,0.04)]">
              <h2 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider font-github">Refined du'a</h2>
              {query.trim() && (
                <p className="mb-2 text-xs text-slate-500 font-github italic">From: &ldquo;{query.trim()}&rdquo;</p>
              )}
              <p className="whitespace-pre-wrap text-slate-100 font-calligraphy text-lg leading-relaxed">{refinedDua}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="font-github border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30"
                  variant="outline"
                  size="sm"
                  onClick={handleAddToFavorites}
                >
                  <Plus className="size-4 mr-1 inline" />
                  Add to favorites
                </Button>
                <Button
                  className="font-github border-slate-500/40 text-slate-200 hover:bg-white/5"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveToLibrary}
                  disabled={saved}
                >
                  {saved ? "Saved to Library" : "Save to Library"}
                </Button>
                <Button
                  className="font-github border-slate-500/40 text-slate-200 hover:bg-white/5"
                  variant="outline"
                  size="sm"
                  onClick={openShareModal}
                  aria-label="Share as image"
                >
                  <Share2 className="size-4 mr-1 inline" />
                  Share
                </Button>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
}
