/**
 * Pre-computed at module load so prod refine API does no per-request work building this.
 * Used by /api/refine to inject all 99 Names into the agent instructions.
 */

import namesOfAllah from "./names-of-allah.json";

const names = namesOfAllah as { english: string; meaning: string }[];

export const NAMES_OF_ALLAH_REFINE_CONTEXT =
  "All 99 Names of Allah (choose the most relevant for this intention): " +
  names.map((n) => `${n.english} (${n.meaning})`).join(", ");
