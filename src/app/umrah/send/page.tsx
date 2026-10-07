import type { Metadata } from "next";
import SendClient from "./SendClient";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}): Promise<Metadata> {
  const { to } = await searchParams;
  const name = to?.trim().slice(0, 40);
  return {
    title: name ? `Send du'as for ${name}'s Umrah · du'aOS` : "Send Umrah du'as · du'aOS",
    description: "Type your du'as and send them as a link — nothing is uploaded.",
  };
}

export default function SendPage() {
  return <SendClient />;
}
