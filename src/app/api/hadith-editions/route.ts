import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HADITH_EDITIONS } from "@/lib/validation";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Service unavailable. Check SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("spiritual_assets")
    .select("metadata")
    .contains("metadata", { type: "hadith" })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: "Failed to load hadith editions." }, { status: 500 });
  }

  const allowed = new Set<string>(HADITH_EDITIONS);
  const found = new Set<string>();
  for (const row of data ?? []) {
    const edition = row?.metadata?.edition;
    if (typeof edition === "string" && allowed.has(edition)) found.add(edition);
  }

  const editions = HADITH_EDITIONS.filter((e) => found.has(e));
  return NextResponse.json({ editions });
}

