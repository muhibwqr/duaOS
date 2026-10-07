"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { DISPLAY_NAME_KEY } from "@/lib/library-storage";
import { encodeSharePayload, buildShareUrl } from "@/lib/share-codec";
import umrahDuas from "@/data/umrah-duas.json";

type Curated = { id: string; stage: string; title: string; arabic: string; transliteration: string; translation: string; source: string };
const CURATED = umrahDuas as Curated[];

const cardCls =
  "rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]";

export default function SendClient() {
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("to");
    if (t) setTo(t.trim().slice(0, 40));
    try {
      setFrom(localStorage.getItem(DISPLAY_NAME_KEY) ?? "");
    } catch {
      // ignore
    }
  }, []);

  const lines = useMemo(
    () => text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30).map((l) => l.slice(0, 500)),
    [text]
  );

  const curatedItems = CURATED.filter((c) => picked.has(c.id)).map((c) => `${c.arabic}\n${c.translation}`);
  const total = lines.length + curatedItems.length;

  const flash = (key: string) => {
    setFeedback(key);
    setTimeout(() => setFeedback(null), 2000);
  };

  async function create() {
    if (total === 0 || creating) return;
    setCreating(true);
    try {
      const trimmedFrom = from.trim().slice(0, 80) || undefined;
      try {
        localStorage.setItem(DISPLAY_NAME_KEY, from.trim());
      } catch {
        // ignore
      }
      const at = new Date().toISOString();
      const code = await encodeSharePayload({
        v: 1,
        kind: "list",
        title: `Du'as for ${to.trim() || "your Umrah"}`,
        umrah: true,
        items: [...lines, ...curatedItems].map((dua) => ({ dua, from: trimmedFrom, at })),
      });
      setCode(code);
      setLink(buildShareUrl(code, { mode: "query", path: "/umrah" }));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-8 sm:py-12 pt-24 sm:pt-28 pb-[env(safe-area-inset-bottom)]">
        <header className="mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            Du&apos;as for {to ? `${to}'s` : "their"} Umrah
          </h1>
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">
            Write your du&apos;as below — they&apos;ll merge them into their Umrah list with one tap.
          </p>
        </header>

        <section className={`${cardCls} p-4 sm:p-6`}>
          <input
            type="text"
            value={from}
            onChange={(e) => setFrom(e.target.value.slice(0, 80))}
            placeholder="Your name (optional)"
            className="w-full rounded-lg border border-slate-200/80 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-github text-sm px-3 py-2 placeholder:text-slate-500"
            aria-label="Your name"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your du'as — one per line"
            className="mt-3 w-full h-36 rounded-lg border border-slate-200/80 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-calligraphy text-base p-3 resize-y placeholder:text-slate-500"
            aria-label="Your du'as, one per line"
          />
          <p className="mt-1 text-xs font-github text-slate-400 dark:text-slate-500">
            {lines.length} written · {curatedItems.length} picked below · up to 30 total
          </p>

          <p className="mt-4 mb-2 font-github text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Or pick from recommended du&apos;as
          </p>
          <div className="flex flex-wrap gap-2">
            {CURATED.map((c) => {
              const on = picked.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setPicked((s) => {
                      const next = new Set(s);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-github transition-colors ${
                    on
                      ? "border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200/80 dark:border-slate-500/50 bg-white/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {c.title}
                </button>
              );
            })}
          </div>

          <Button
            className="mt-4 w-full font-github bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            disabled={total === 0 || creating}
            onClick={() => void create()}
          >
            {creating ? "Creating…" : `Create link (${total} du'a${total === 1 ? "" : "s"})`}
          </Button>

          {link && (
            <div className="mt-4">
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-3 text-xs font-github text-slate-700 dark:text-slate-300 break-all select-all">
                {link}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-github border-emerald-500/40 text-emerald-700 dark:text-emerald-300 justify-center hover:bg-emerald-500/10"
                  onClick={() => void navigator.clipboard.writeText(link).then(() => flash("link"))}
                >
                  {feedback === "link" ? "Copied" : "Copy link"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    void (async () => {
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: `Du'as for ${to || "your"} Umrah`, url: link });
                          return;
                        }
                      } catch {
                        // fall through
                      }
                      await navigator.clipboard.writeText(link);
                      flash("link");
                    })();
                  }}
                >
                  Share…
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => code && void navigator.clipboard.writeText(code).then(() => flash("code"))}
                >
                  {feedback === "code" ? "Copied" : "Copy code"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-400 font-github">
                Nothing is uploaded — the du&apos;as live in the link.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
