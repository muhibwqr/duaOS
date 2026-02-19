import { z } from "zod";

/** Max lengths to prevent abuse and stay within model limits */
const MAX_QUERY_LENGTH = 2000;
const MAX_USER_INPUT_LENGTH = 5000;
const MAX_CONTEXT_LENGTH = 2000;
/** Refine can accept multiple hadith (full text + refs); allow longer than single-context limit */
export const MAX_HADITH_CONTEXT_LENGTH = 5000;

const safeString = (maxLen: number) =>
  z
    .string()
    .min(1, "Required")
    .max(maxLen, `Must be ${maxLen} characters or less`)
    .transform((s) => s.trim())
    .refine((s) => s.length >= 1, "Required after trimming");

const optionalSafeString = (maxLen: number) =>
  z
    .union([
      z.string().max(maxLen, `Must be ${maxLen} characters or less`).transform((s) => (s?.trim() ?? "").slice(0, maxLen)),
      z.undefined(),
    ])
    .optional()
    .default("");

/** All hadith-api English editions (must match metadata.edition in spiritual_assets). Default "All" = "". */
export const HADITH_EDITIONS = [
  "eng-bukhari",
  "eng-muslim",
  "eng-abudawud",
  "eng-tirmidhi",
  "eng-nasai",
  "eng-ibnmajah",
  "eng-malik",
  "eng-nawawi",
  "eng-qudsi",
  "eng-dehlawi",
] as const;
export type HadithEdition = (typeof HADITH_EDITIONS)[number];

/** Display labels for hadith edition switcher. */
export const HADITH_EDITION_LABELS: Record<string, string> = {
  "": "All (default)",
  "eng-bukhari": "Sahih Bukhari",
  "eng-muslim": "Sahih Muslim",
  "eng-abudawud": "Sunan Abu Dawud",
  "eng-tirmidhi": "Jami At Tirmidhi",
  "eng-nasai": "Sunan an-Nasai",
  "eng-ibnmajah": "Sunan Ibn Majah",
  "eng-malik": "Muwatta Malik",
  "eng-nawawi": "Forty Hadith Nawawi",
  "eng-qudsi": "Forty Hadith Qudsi",
  "eng-dehlawi": "Forty Hadith Dehlawi",
};

export const searchBodySchema = z.object({
  query: safeString(MAX_QUERY_LENGTH),
  intent: z.enum(["problem", "refine", "goal"]).optional(),
  edition: z.union([z.enum(HADITH_EDITIONS), z.literal("")]).optional().default(""),
  /** When false, skip LLM selection step (e.g. for debugging). Default true. */
  llm_filter: z.boolean().optional().default(true),
});

export const refineBodySchema = z.object({
  userInput: safeString(MAX_USER_INPUT_LENGTH),
  nameOfAllah: optionalSafeString(MAX_CONTEXT_LENGTH),
  hadith: optionalSafeString(MAX_HADITH_CONTEXT_LENGTH),
  quran: optionalSafeString(MAX_HADITH_CONTEXT_LENGTH),
});

/** Body for POST /api/duas (store a user-submitted du'a). */
export const storeDuaBodySchema = z.object({
  content: safeString(MAX_USER_INPUT_LENGTH),
  nameOfAllah: z.string().max(MAX_CONTEXT_LENGTH).optional(),
  hadithSnippet: z.string().max(MAX_CONTEXT_LENGTH).optional(),
  intent: z.enum(["problem", "refine", "goal"]).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;
export type RefineBody = z.infer<typeof refineBodySchema>;
export type StoreDuaBody = z.infer<typeof storeDuaBodySchema>;