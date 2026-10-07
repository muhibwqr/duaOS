"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  addToUmrahList,
  getUmrahDone,
  getUmrahList,
  normalizeDuaText,
  parseDuaOSImportAsync,
  removeFromUmrahList,
  toggleUmrahDone,
  DISPLAY_NAME_KEY,
} from "@/lib/library-storage";
import { encodeSharePayload, buildShareUrl, type SharePayload } from "@/lib/share-codec";
import type { DuaList, LibraryEntry } from "@/types/dua";
import umrahDuas from "@/data/umrah-duas.json";

type Curated = { id: string; stage: string; title: string; arabic: string; transliteration: string; translation: string; source: string };
const CURATED = umrahDuas as Curated[];
const STAGES = ["Ihram", "Arriving", "Tawaf", "Sa'i", "Anytime"];
const ARABIC_RE = /[؀-ۿ]/;

const curatedEntry = (c: Curated): LibraryEntry => ({
  dua: `${c.arabic}\n${c.translation}`,
  at: new Date().toISOString(),
});

const cardCls =
  "rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]";
const actionBtn =
  "font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";

export default function UmrahClient() {
  const [list, setList] = useState<DuaList | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [pasteInput, setPasteInput] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [toName, setToName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const autoImported = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage must be read post-mount to avoid hydration mismatch
    setList(getUmrahList());
    setDone(getUmrahDone());
    try {
      setToName(localStorage.getItem(DISPLAY_NAME_KEY) ?? "");
    } catch {
      // ignore
    }
  }, []);

  const flash = (key: string) => {
    setFeedback(key);
    setTimeout(() => setFeedback(null), 2000);
  };

  const refresh = useCallback(() => setList(getUmrahList()), []);

  const mergeEntries = useCallback(
    (entries: LibraryEntry[]) => {
      const { added, skipped } = addToUmrahList(entries);
      refresh();
      setImportMsg(`Added ${added}${skipped > 0 ? `, ${skipped} already in your list` : ""}`);
      setTimeout(() => setImportMsg(null), 3000);
    },
    [refresh]
  );

  const importRaw = useCallback(
    async (raw: string) => {
      const parsed = await parseDuaOSImportAsync(raw);
      if (!parsed) {
        setImportErr("Couldn't read that link or code.");
        return false;
      }
      if (parsed.type === "request") {
        mergeEntries([{ dua: parsed.request.text, name: parsed.request.name, from: parsed.request.from, at: parsed.request.at }]);
        return true;
      }
      if (parsed.type === "state") {
        const items = [
          ...parsed.library,
          ...parsed.favorites.map((f) => ({ dua: f.dua, name: f.nameOfAllah, at: new Date().toISOString() })),
          ...parsed.lists.flatMap((l) => l.items),
        ];
        mergeEntries(items);
        return true;
      }
      if (parsed.type === "list") {
        mergeEntries(parsed.list.items);
        return true;
      }
      mergeEntries(parsed.entries);
      return true;
    },
    [mergeEntries]
  );

  // ?c=<code> auto-import, once
  useEffect(() => {
    if (autoImported.current) return;
    autoImported.current = true;
    const c = new URLSearchParams(window.location.search).get("c");
    if (!c) return;
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- importRaw is async; setState runs after await
    void importRaw(c);
  }, [importRaw]);

  const collectLink = `${typeof window !== "undefined" ? window.location.origin : ""}/umrah/send${toName.trim() ? `?to=${encodeURIComponent(toName.trim())}` : ""}`;

  async function shareMyList() {
    if (!list) return;
    const payload: SharePayload = {
      v: 1,
      kind: "list",
      id: list.id,
      title: list.title,
      umrah: true,
      items: list.items.map((i) => ({ dua: i.dua, name: i.name, from: i.from, at: i.at })),
    };
    const code = await encodeSharePayload(payload);
    await navigator.clipboard.writeText(buildShareUrl(code, { mode: "query" }));
    flash("shareList");
  }

  function exportTxt() {
    if (!list || list.items.length === 0) return;
    const lines: string[] = ["My Umrah du'as — du'aOS", ""];
    for (const i of list.items) {
      lines.push(i.dua);
      if (i.name) lines.push(`— ${i.name}`);
      if (i.from) lines.push(`from ${i.from}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n").trim()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "umrah-duas.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    flash("txt");
  }

  const items = list?.items ?? [];
  const fromFriends = items.filter((i) => i.from).length;
  const itemKeys = new Set(items.map((i) => normalizeDuaText(i.dua)));

  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-8 sm:py-12 pt-32 sm:pt-36 pb-[env(safe-area-inset-bottom)]">
        {/* Hero */}
        <header className="mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            Your Umrah du&apos;as
          </h1>
          <p className="font-github text-sm text-slate-500 dark:text-slate-400 mb-1">
            Collect du&apos;as from friends and carry them with you.
          </p>
          <p className="font-github text-xs text-slate-400 dark:text-slate-500">
            {items.length} du&apos;a{items.length === 1 ? "" : "s"} · {fromFriends} from friends · {items.filter((i) => done.includes(normalizeDuaText(i.dua))).length} made
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="font-github bg-emerald-600 hover:bg-emerald-500 text-white border-0" size="sm" onClick={() => setAskOpen(true)}>
              Ask friends for du&apos;as
            </Button>
            <Button variant="outline" size="sm" className={actionBtn} onClick={() => void shareMyList()} disabled={items.length === 0}>
              {feedback === "shareList" ? "Link copied" : "Share my list"}
            </Button>
            <Button variant="outline" size="sm" className={actionBtn} onClick={exportTxt} disabled={items.length === 0}>
              {feedback === "txt" ? "Downloaded" : "Export .txt"}
            </Button>
          </div>
        </header>

        {/* Ask friends modal */}
        {askOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            aria-modal="true"
            role="dialog"
            aria-label="Ask friends for du'as"
            onClick={() => setAskOpen(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-6 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => setAskOpen(false)} className="absolute top-3 right-3 p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
                <X className="size-5" />
              </button>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 font-github mb-1">Ask friends for du&apos;as</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-github mb-4">
                They type their du&apos;as, you get a link back — one tap adds them to your list.
              </p>
              <input
                type="text"
                value={toName}
                onChange={(e) => setToName(e.target.value.slice(0, 40))}
                placeholder="Your name (optional)"
                className="w-full rounded-lg border border-slate-200/80 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-github text-sm px-3 py-2 placeholder:text-slate-500"
                aria-label="Your name (optional)"
              />
              <p className="mt-3 rounded-lg border border-slate-200/80 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-900/50 p-3 text-xs font-github text-slate-700 dark:text-slate-300 break-all select-all">
                {collectLink}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-github border-emerald-500/40 text-emerald-700 dark:text-emerald-300 justify-center hover:bg-emerald-500/10"
                  onClick={() => void navigator.clipboard.writeText(collectLink).then(() => flash("collect"))}
                >
                  {feedback === "collect" ? "Copied" : "Copy link"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={actionBtn + " justify-center"}
                  onClick={() => {
                    void (async () => {
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: "Send du'as for my Umrah", url: collectLink });
                          return;
                        }
                      } catch {
                        // fall through
                      }
                      await navigator.clipboard.writeText(collectLink);
                      flash("collect");
                    })();
                  }}
                >
                  Share…
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Paste box */}
        <section className={`${cardCls} p-4 sm:p-6 mb-8`} aria-label="Add du'as someone sent you">
          <h2 className="font-github text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Add du&apos;as someone sent you
          </h2>
          <textarea
            value={pasteInput}
            onChange={(e) => { setPasteInput(e.target.value); setImportErr(null); }}
            placeholder="Paste a du'aOS link or code…"
            className="w-full h-20 rounded-lg border border-slate-200/80 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-github text-sm p-3 resize-y placeholder:text-slate-500"
            aria-label="Paste a du'aOS link or code"
          />
          {importErr && <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-github">{importErr}</p>}
          {importMsg && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-github">{importMsg}</p>}
          <Button
            className="mt-3 font-github"
            size="sm"
            disabled={!pasteInput.trim()}
            onClick={() => {
              void (async () => {
                const ok = await importRaw(pasteInput);
                if (ok) setPasteInput("");
              })();
            }}
          >
            Add to my Umrah list
          </Button>
        </section>

        {/* My list */}
        <section className="mb-10" aria-label="My Umrah list">
          <h2 className="font-github text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            My Umrah list
          </h2>
          {items.length === 0 ? (
            <p className="font-github text-sm text-slate-500 dark:text-slate-400">
              Add du&apos;as from the recommendations below, or paste a link a friend sent you.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((item, i) => {
                const key = normalizeDuaText(item.dua);
                const isDone = done.includes(key);
                const isArabic = ARABIC_RE.test(item.dua);
                return (
                  <li
                    key={`${key}-${i}`}
                    className={`${cardCls} p-4 sm:p-5 transition-opacity ${isDone ? "opacity-70" : ""}`}
                  >
                    <p
                      dir={isArabic ? "rtl" : undefined}
                      className={`whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 ${isArabic ? "font-calligraphy text-xl" : "font-serif text-base"} ${isDone ? "line-through decoration-emerald-500/60" : ""}`}
                    >
                      {item.dua}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.name && (
                        <span className="rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 text-xs font-github text-emerald-700 dark:text-emerald-300">
                          {item.name}
                        </span>
                      )}
                      {item.from && (
                        <span className="rounded-full bg-slate-200/70 dark:bg-slate-700/50 px-2 py-0.5 text-xs font-github text-slate-600 dark:text-slate-300">
                          from {item.from}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDone(toggleUmrahDone(item.dua))}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github ${isDone ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        aria-pressed={isDone}
                      >
                        <Check className="size-3.5" />
                        {isDone ? "Made du'a" : "Mark made"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setList(removeFromUmrahList(item.dua));
                          setDone(getUmrahDone());
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        aria-label="Remove"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recommended */}
        <section aria-label="Recommended for Umrah">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-github text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Recommended for Umrah
            </h2>
            <button
              type="button"
              onClick={() => mergeEntries(CURATED.map(curatedEntry))}
              className="text-xs font-github text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Add all
            </button>
          </div>
          {STAGES.map((stage) => {
            const group = CURATED.filter((c) => c.stage === stage);
            if (group.length === 0) return null;
            return (
              <div key={stage} className="mb-6">
                <h3 className="font-serif text-lg font-medium text-emerald-700 dark:text-emerald-400 mb-2">{stage}</h3>
                <ul className="space-y-4">
                  {group.map((c) => {
                    const inList = itemKeys.has(normalizeDuaText(curatedEntry(c).dua));
                    return (
                      <li key={c.id} className={`${cardCls} p-4 sm:p-5`}>
                        <p className="font-github text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{c.title}</p>
                        <p dir="rtl" className="font-calligraphy text-xl leading-relaxed text-slate-800 dark:text-slate-100">
                          {c.arabic}
                        </p>
                        <p className="mt-2 font-serif text-sm italic text-slate-500 dark:text-slate-400">{c.transliteration}</p>
                        <p className="mt-1 font-serif text-sm text-slate-700 dark:text-slate-300">{c.translation}</p>
                        <p className="mt-2 font-github text-xs text-slate-400 dark:text-slate-500">{c.source}</p>
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={inList}
                            onClick={() => mergeEntries([curatedEntry(c)])}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-github ${inList ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20"}`}
                          >
                            {inList ? "In your list" : "Add to my list"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
