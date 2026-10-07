"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { decodeSharePayload, type SharePayload, type SharedDua } from "@/lib/share-codec";
import {
  saveToLibrary,
  addToFavorites,
  upsertRequest,
  markRequestMade,
  getRequests,
  upsertList,
  addToUmrahList,
  applyState,
  parseDuaOSImportAsync,
} from "@/lib/library-storage";

type DecodeState = "loading" | "invalid" | "ready";

export default function SharedClient() {
  const router = useRouter();
  const [state, setState] = useState<DecodeState>("loading");
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [pasteInput, setPasteInput] = useState("");
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});
  const [madeRequest, setMadeRequest] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [restored, setRestored] = useState<{ duas: number; lists: number } | null>(null);

  const decode = useCallback(async (raw: string) => {
    const p = await decodeSharePayload(raw);
    if (p) {
      setCurrentCode(raw);
      setPayload(p);
      setState("ready");
      if (p.kind === "request") {
        const existing = getRequests().find((r) => r.id === p.request.id);
        upsertRequest({ ...p.request, direction: "received", madeAt: existing?.madeAt });
        setMadeRequest(Boolean(existing?.madeAt));
      }
    } else {
      setPayload(null);
      setState("invalid");
    }
  }, []);

  const readCode = useCallback(
    () => new URLSearchParams(window.location.search).get("c") ?? window.location.hash.slice(1),
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decode is async; setState runs after await
    void decode(readCode());
    const onHashChange = () => {
      setState("loading");
      setPayload(null);
      setMadeRequest(false);
      setRestored(null);
      setFeedback({});
      void decode(readCode());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [decode, readCode]);

  const flash = (key: string) => {
    setFeedback((f) => ({ ...f, [key]: true }));
    setTimeout(() => setFeedback((f) => ({ ...f, [key]: false })), 2000);
  };

  const saveItem = (item: SharedDua, key: string) => {
    saveToLibrary(item.dua, item.name);
    flash(key);
  };

  const favItem = (item: SharedDua, key: string) => {
    addToFavorites({ dua: item.dua, nameOfAllah: item.name });
    flash(key);
  };

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text).then(() => flash(key));
  };

  const actionBtn =
    "font-github border-slate-200/80 dark:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-8 sm:py-12 pt-32 sm:pt-36 pb-[env(safe-area-inset-bottom)]">
        {state === "loading" && (
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">Opening shared du&apos;a…</p>
        )}

        {state === "invalid" && (
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
            <h1 className="font-serif text-xl sm:text-2xl font-medium text-slate-800 dark:text-slate-100 mb-2">
              This link doesn&apos;t contain a du&apos;a
            </h1>
            <p className="font-github text-sm text-slate-500 dark:text-slate-400 mb-4">
              Paste a du&apos;aOS link or code below to open it.
            </p>
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="Paste a link or code…"
              className="w-full h-24 rounded-lg border border-slate-200/80 dark:border-slate-500/50 bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-github text-sm p-3 resize-y placeholder:text-slate-500"
              aria-label="Paste a share link or code"
            />
            <Button
              className="mt-3 font-github"
              disabled={!pasteInput.trim()}
              onClick={() => void decode(pasteInput)}
            >
              Open
            </Button>
          </section>
        )}

        {state === "ready" && payload?.kind === "dua" && (
          <DuaCard item={payload.item}>
            <Button variant="outline" size="sm" className={actionBtn} onClick={() => saveItem(payload.item, "save")}>
              {feedback.save ? "Saved" : "Save to Library"}
            </Button>
            <Button variant="outline" size="sm" className={actionBtn} onClick={() => favItem(payload.item, "fav")}>
              {feedback.fav ? "Added" : "Add to favorites"}
            </Button>
            <Button variant="outline" size="sm" className={actionBtn} onClick={() => copyText(payload.item.dua, "copy")}>
              {feedback.copy ? "Copied" : "Copy text"}
            </Button>
            <Button variant="outline" size="sm" className={actionBtn} asChild>
              <Link href={`/?q=${encodeURIComponent((payload.item.name || payload.item.dua).slice(0, 120))}`}>
                Make my own
              </Link>
            </Button>
          </DuaCard>
        )}

        {state === "ready" && payload?.kind === "list" && (
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
            <h1 className="font-serif text-xl sm:text-2xl font-medium text-slate-800 dark:text-slate-100 mb-1">
              {payload.title || "Shared du'a list"}
            </h1>
            <p className="font-github text-sm text-slate-500 dark:text-slate-400 mb-4">
              {payload.items.length} du&apos;a{payload.items.length === 1 ? "" : "s"}
            </p>
            <div className="mb-6 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className={actionBtn}
                onClick={() => {
                  payload.items.forEach((i) => saveToLibrary(i.dua, i.name));
                  flash("saveAll");
                }}
              >
                {feedback.saveAll ? "Saved" : "Save all to Library"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={actionBtn}
                onClick={() => {
                  payload.items.forEach((i) => addToFavorites({ dua: i.dua, nameOfAllah: i.name }));
                  flash("favAll");
                }}
              >
                {feedback.favAll ? "Added" : "Add all to favorites"}
              </Button>
              {payload.id && !payload.umrah && (
                <Button
                  className="font-github bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                  size="sm"
                  onClick={() => {
                    upsertList({
                      id: payload.id!,
                      title: payload.title?.trim() || "Shared list",
                      items: payload.items.map((i) => ({ dua: i.dua, name: i.name, from: i.from, at: i.at || new Date().toISOString() })),
                      at: new Date().toISOString(),
                    });
                    flash("saveList");
                  }}
                >
                  {feedback.saveList ? "Saved" : "Save as list"}
                </Button>
              )}
              {payload.umrah && (
                <>
                  <Button
                    className="font-github bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                    size="sm"
                    onClick={() => {
                      addToUmrahList(
                        payload.items.map((i) => ({ dua: i.dua, name: i.name, from: i.from, at: i.at || new Date().toISOString() }))
                      );
                      flash("umrahAdd");
                    }}
                  >
                    {feedback.umrahAdd ? "Added to your Umrah list" : "Add to my Umrah list"}
                  </Button>
                  <Button variant="outline" size="sm" className={actionBtn} asChild>
                    <Link href="/umrah">Open my Umrah page</Link>
                  </Button>
                </>
              )}
            </div>
            <div className="space-y-4">
              {payload.items.map((item, i) => (
                <DuaCard key={i} item={item} compact>
                  <Button variant="outline" size="sm" className={actionBtn} onClick={() => saveItem(item, `save-${i}`)}>
                    {feedback[`save-${i}`] ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" size="sm" className={actionBtn} onClick={() => favItem(item, `fav-${i}`)}>
                    {feedback[`fav-${i}`] ? "Added" : "Favorite"}
                  </Button>
                </DuaCard>
              ))}
            </div>
          </section>
        )}

        {state === "ready" && payload?.kind === "state" && (
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
            <h1 className="font-serif text-xl sm:text-2xl font-medium text-slate-800 dark:text-slate-100 mb-2">
              du&apos;aOS state code
            </h1>
            <p className="font-github text-sm text-slate-500 dark:text-slate-400 mb-4">
              {payload.library.length + payload.favorites.length} du&apos;as · {payload.lists.length} list
              {payload.lists.length === 1 ? "" : "s"} · {payload.requests.length} request
              {payload.requests.length === 1 ? "" : "s"}. Restoring merges into this browser without duplicating.
            </p>
            <Button
              className="font-github bg-emerald-600 hover:bg-emerald-500 text-white border-0"
              disabled={restored !== null}
              onClick={() => {
                void parseDuaOSImportAsync(currentCode).then((parsed) => {
                  if (parsed?.type === "state") setRestored(applyState(parsed));
                });
              }}
            >
              {restored ? `Restored ${restored.duas} du'as, ${restored.lists} lists` : "Restore here"}
            </Button>
          </section>
        )}

        {state === "ready" && payload?.kind === "request" && (
          <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
            <h1 className="font-serif text-xl sm:text-2xl font-medium text-slate-800 dark:text-slate-100 mb-4">
              {payload.request.from || "Someone"} is asking for your du&apos;a
            </h1>
            <p className="font-calligraphy text-lg text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed mb-3">
              {payload.request.text}
            </p>
            {payload.request.name && (
              <p className="font-github text-sm text-slate-500 dark:text-slate-400 mb-6">
                Suggested Name: <span className="text-emerald-600 dark:text-emerald-400">{payload.request.name}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="font-github bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                onClick={() => {
                  markRequestMade(payload.request.id);
                  setMadeRequest(true);
                }}
                disabled={madeRequest}
              >
                {madeRequest ? (
                  <>
                    <Check className="size-4 mr-1 inline" /> Du&apos;a made
                  </>
                ) : (
                  "I made du'a for this"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={actionBtn}
                onClick={() => router.push(`/?q=${encodeURIComponent(payload.request.text)}&run=1`)}
              >
                Find a du&apos;a for this
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={actionBtn}
                onClick={() => {
                  addToFavorites({ dua: payload.request.text, nameOfAllah: payload.request.name });
                  flash("addMine");
                }}
              >
                {feedback.addMine ? "Added" : "Add to my du'a list"}
              </Button>
            </div>
          </section>
        )}

        <p className="mt-8 text-center font-github text-xs text-slate-500 dark:text-slate-400">
          Shared links contain the du&apos;a itself — nothing is stored on a server.
        </p>
      </main>
    </div>
  );
}

function DuaCard({
  item,
  children,
  compact,
}: {
  item: SharedDua;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl shadow-[0_2px_24px_rgba(0,0,0,0.06)] ${compact ? "p-4 sm:p-5" : "p-6 sm:p-8"}`}
    >
      <p className="font-calligraphy text-lg text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
        {item.dua}
      </p>
      {item.name && (
        <p className="mt-3 font-github text-sm text-slate-500 dark:text-slate-400">— {item.name}</p>
      )}
      {item.sources && item.sources.length > 0 && (
        <ul className="mt-3 space-y-1">
          {item.sources.map((s, i) => (
            <li key={i} className="font-github text-xs text-slate-500 dark:text-slate-400">
              {s}
            </li>
          ))}
        </ul>
      )}
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </section>
  );
}
