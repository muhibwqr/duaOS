import type { Metadata } from "next";
import SharedClient from "./SharedClient";
import { decodeSharePayload } from "@/lib/share-codec";
import { buildSharePreview } from "@/lib/share-preview";

const FALLBACK: Metadata = {
  title: "Shared du'a | du'aOS",
  description: "A du'a shared with you — the content lives in the link itself.",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}): Promise<Metadata> {
  const { c } = await searchParams;
  if (!c) return FALLBACK;
  const payload = await decodeSharePayload(c).catch(() => null);
  // Requests stay hash-only/private — no server-side preview of their content.
  if (!payload || payload.kind === "request") return FALLBACK;
  const { title, description } = buildSharePreview(payload);
  const image = `/api/og?c=${encodeURIComponent(c)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function SharedPage() {
  return <SharedClient />;
}
