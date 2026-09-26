/**
 * Pure helpers for rich link previews: name parsing and share preview text.
 * No browser globals — safe for server components, edge routes, and tests.
 */

import type { SharePayload } from "@/lib/share-codec";

/** Split "English (Meaning) - العربية" content format into display parts. */
export function parseNameContent(content: string): { english: string; meaning: string; arabic: string } {
  const dashIdx = content.lastIndexOf(" - ");
  const arabic = dashIdx >= 0 ? content.slice(dashIdx + 3).trim() : "";
  const head = dashIdx >= 0 ? content.slice(0, dashIdx) : content;
  const parenIdx = head.indexOf(" (");
  const english = (parenIdx >= 0 ? head.slice(0, parenIdx) : head).trim();
  const meaning = parenIdx >= 0 ? head.slice(parenIdx + 2, head.endsWith(")") ? -1 : undefined).trim() : "";
  return { english, meaning, arabic };
}

export type SharePreview = {
  title: string;
  description: string;
  lines: { dua: string; name?: string }[];
};

const MAX_LINES = 3;
const DUA_TRUNCATE = 110;
const DESC_MAX = 300;

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function buildSharePreview(p: SharePayload): SharePreview {
  if (p.kind === "request") {
    return {
      title: "A du'a request · du'aOS",
      description: "Someone is asking for your du'a.",
      lines: [],
    };
  }
  if (p.kind === "state") {
    return {
      title: "A du'aOS library · du'aOS",
      description: "Import a shared du'aOS library.",
      lines: [],
    };
  }

  const lines =
    p.kind === "dua"
      ? [{ dua: p.item.dua, name: p.item.name }]
      : p.items.slice(0, MAX_LINES).map((i) => ({ dua: i.dua, name: i.name }));

  let title: string;
  if (p.kind === "dua") {
    const english = p.item.name ? parseNameContent(p.item.name).english : "";
    title = english ? `${english} · du'aOS` : "A du'a · du'aOS";
  } else {
    const n = p.items.length;
    title = `${p.title ?? "A du'a list"} · ${n} du'a${n === 1 ? "" : "s"} · du'aOS`;
  }

  const description = truncate(
    lines
      .map((l) => {
        const english = l.name ? parseNameContent(l.name).english : "";
        return `“${truncate(l.dua.trim(), DUA_TRUNCATE)}”${english ? ` — ${english}` : ""}`;
      })
      .join(" · "),
    DESC_MAX
  );

  return { title, description, lines };
}
