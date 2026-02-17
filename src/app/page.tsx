"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, ChevronDown, Mic } from "lucide-react";
import { Header } from "@/components/Header";
import { KofiBanner } from "@/components/KofiBanner";
import { Button } from "@/components/ui/button";
import { HADITH_EDITIONS, HADITH_EDITION_LABELS } from "@/lib/validation";

const MUHIB_URL = "https://muhibwaqar.com";
const HADITH_EDITION_STORAGE_KEY = "duaos-hadith-edition";

type Intent = "problem" | "refine" | "goal";

type SearchResult = {
  name: { id: string; content: string; metadata: Record<string, unknown> } | null;
  hadith: { id: string; content: string; metadata: Record<string, unknown> } | null;
};

type LedgerEntry = { dua: string; name?: string; at: string };

const LEDGER_KEY = "duaos-ledger";
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

function getLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLedger(dua: string, name?: string) {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LEDGER_KEY) : null;
    const list: { dua: string; name?: string; at: string }[] = raw ? JSON.parse(raw) : [];
    list.push({ dua, name, at: new Date().toISOString() });
    localStorage.setItem(LEDGER_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Save to ledger failed", e);
  }
}

export default function Home() {
  const [intent, setIntent] = useState<Intent>("problem");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [refinedDua, setRefinedDua] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [edition, setEdition] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const s = localStorage.getItem(HADITH_EDITION_STORAGE_KEY);
      return s && (s === "" || HADITH_EDITIONS.includes(s as (typeof HADITH_EDITIONS)[number])) ? s : "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    setLedger(getLedger());
  }, [saved]);

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
    setIsSearching(true);
    setSearchResult(null);
    setSearchError(null);
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
        setSearchResult({ name: null, hadith: null });
        return;
      }
      const data = JSON.parse(text);
      setSearchResult({ name: data.name, hadith: data.hadith });
    } catch (e) {
      console.error(e);
      setSearchError(e instanceof Error ? e.message : "Search failed. Check your connection and try again.");
      setSearchResult({ name: null, hadith: null });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleRefine() {
    const text = (query.trim() || refinedDua).slice(0, MAX_REFINE_INPUT_LENGTH);
    if (!text) return;
    const nameContent = (searchResult?.name?.content ?? "").slice(0, MAX_CONTEXT_LENGTH);
    const hadithContent = (searchResult?.hadith?.content ?? "").slice(0, MAX_CONTEXT_LENGTH);
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

  function handleSaveToLedger() {
    const text = refinedDua.trim();
    if (!text) return;
    saveToLedger(text, searchResult?.name?.content);
    setSaved(true);
    setLedger(getLedger());
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

  return (
    <div className="min-h-screen bg-transparent text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center mx-auto max-w-2xl w-full px-4 py-12 pt-28">
        <KofiBanner />
        <h1 className="font-serif text-2xl text-slate-100 text-center mb-6 leading-relaxed mt-4">
          What do you want to make du'a for today?
        </h1>
        {/* Chatbox: input + edition dropdown + voice + submit (no + button) */}
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
                {HADITH_EDITIONS.map((e) => (
                  <option key={e} value={e}>
                    {HADITH_EDITION_LABELS[e] ?? e}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 size-3.5 pointer-events-none text-slate-400 shrink-0" aria-hidden />
            </div>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`shrink-0 p-1.5 rounded-md transition-colors ${isRecording ? "text-red-400 bg-red-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
              aria-label={isRecording ? "Stop recording" : "Voice input"}
            >
              <Mic className="size-5" />
            </button>
            <button
              type="button"
              onClick={handleSearch}
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
        {searchResult && (searchResult.name || searchResult.hadith) && (
          <section className="mt-8 w-full rounded-xl border border-slate-500/20 bg-slate-900/30 backdrop-blur-xl p-4 text-slate-200 font-github shadow-[0_0_24px_rgba(5,150,105,0.04)]">
            <h2 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider">From search</h2>
            {searchResult.name && (
              <p className="mb-2">
                <span className="font-medium text-emerald-400/90">Name of Allah:</span> <span className="font-calligraphy">{searchResult.name.content}</span>
              </p>
            )}
            {searchResult.hadith && searchResult.hadith !== searchResult.name && (
              <p className="font-calligraphy">
                <span className="font-medium text-emerald-400/90">Hadith:</span> {searchResult.hadith.content}
              </p>
            )}
            <Button
              className="mt-3 font-github border-slate-500/40 text-slate-200 hover:bg-white/5"
              variant="outline"
              size="sm"
              onClick={() => void handleRefine()}
              disabled={isRefining}
            >
              {isRefining ? "Refining…" : "Refine into du'a"}
            </Button>
          </section>
        )}

        {refinedDua && (
          <section className="mt-6 w-full rounded-xl border border-slate-500/20 bg-slate-900/30 backdrop-blur-xl p-4 shadow-[0_0_24px_rgba(5,150,105,0.04)]">
            <h2 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider font-github">Refined du'a</h2>
            <p className="whitespace-pre-wrap text-slate-100 font-calligraphy text-lg leading-relaxed">{refinedDua}</p>
            <Button
              className="mt-3 font-github border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30"
              variant="outline"
              size="sm"
              onClick={handleSaveToLedger}
              disabled={saved}
            >
              {saved ? "Saved to Ledger" : "Save to Ledger"}
            </Button>
          </section>
        )}

        {ledger.length > 0 && (
          <section className="mt-10 w-full rounded-xl border border-slate-500/20 bg-slate-900/30 backdrop-blur-xl p-4 shadow-[0_0_24px_rgba(5,150,105,0.04)]">
            <h2 className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider font-github">Personal Ledger</h2>
            <ul className="space-y-3">
              {[...ledger].reverse().map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="border-b border-slate-500/20 pb-3 last:border-0 last:pb-0">
                  <p className="whitespace-pre-wrap text-sm text-slate-100 font-calligraphy">{entry.dua}</p>
                  {entry.name && (
                    <p className="mt-1 text-xs text-slate-500 font-github">— {entry.name}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500 font-github">
                    {new Date(entry.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
