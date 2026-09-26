import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Service unavailable. Check Supabase env." },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("dua_name_leaderboard")
      .select("name_of_allah,total")
      .order("total", { ascending: false })
      .limit(20);

    if (error) {
      console.error("dua_name_leaderboard error:", error);
      const hint =
        error.code === "42P01" || error.message?.includes("relation")
          ? " Run supabase/migrations/20260926000000_name_leaderboard.sql in the Supabase SQL Editor."
          : "";
      return NextResponse.json({ error: `Leaderboard failed.${hint}` }, { status: 500 });
    }

    const entries = (data ?? [])
      .filter((r) => typeof r.name_of_allah === "string" && r.name_of_allah.length > 0)
      .map((r) => ({ name: r.name_of_allah as string, total: Number(r.total) || 0 }));
    const total = entries.reduce((sum, e) => sum + e.total, 0);
    return NextResponse.json({ entries, total }, { headers: CACHE_HEADERS });
  } catch (e: unknown) {
    console.error("Leaderboard error:", e);
    return NextResponse.json({ error: "Leaderboard failed." }, { status: 500 });
  }
}
