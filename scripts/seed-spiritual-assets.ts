/**
 * Seed spiritual_assets with 99 Names of Allah.
 * Run: npm run seed  (uses .env; or set env vars and npx tsx scripts/seed-spiritual-assets.ts)
 */
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiKey });
const supabase = createClient(supabaseUrl, supabaseKey);

type NameEntry = { arabic: string; english: string; meaning: string; tags: string[] };

async function getEmbedding(text: string): Promise<number[]> {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return data[0].embedding;
}

async function main() {
  const path = resolve(process.cwd(), "scripts/names-of-allah.json");
  const names: NameEntry[] = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`Seeding ${names.length} names...`);

  for (let i = 0; i < names.length; i++) {
    const { arabic, english, meaning, tags } = names[i];
    const content = `${english} (${meaning}) - ${arabic}`;
    const textForEmbedding = [content, ...tags].join(" ");
    const embedding = await getEmbedding(textForEmbedding);
    const { error } = await supabase.from("spiritual_assets").insert({
      content,
      metadata: { type: "name", tags },
      embedding,
    });
    if (error) {
      console.error(`Error inserting ${english}:`, error);
    } else {
      console.log(`  ${i + 1}/${names.length} ${english}`);
    }
  }
  console.log("Done.");
}

main();
