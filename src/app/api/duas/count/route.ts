import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const { data, error } = await supabase.from("dua_counter_total").select("total").single();

    if (error) {
      console.error("dua_counter_total error:", error);
      const hint =
        error.code === "42P01" || error.message?.includes("relation")
          ? " Run supabase/migrations/20250218000000_secure_counter_rls.sql in the Supabase SQL Editor."
          : "";
      return NextResponse.json({ error: `Count failed.${hint}` }, { status: 500 });
    }

    const total = typeof data?.total === "number" ? data.total : Number(data?.total) ?? 0;
    return NextResponse.json({ count: total });
  } catch (e: unknown) {
    console.error("Count error:", e);
    return NextResponse.json({ error: "Count failed." }, { status: 500 });
  }
}
