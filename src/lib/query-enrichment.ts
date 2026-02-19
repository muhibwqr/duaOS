/**
 * Zero-latency query enrichment for Islamic du'a search.
 * Expands short user queries with related concepts so the embedding
 * model can find semantically relevant hadiths, Quran verses, and Names.
 */

const TOPIC_MAP: Record<string, string> = {
  patience:
    "patience sabr steadfastness endurance perseverance through trials hardship difficulty waiting for Allah's decree acceptance contentment",
  sabr:
    "patience sabr steadfastness endurance perseverance through trials hardship difficulty waiting for Allah's decree",
  patient:
    "patience sabr steadfastness endurance perseverance through trials hardship waiting",

  marriage:
    "marriage spouse nikah wedding husband wife partner finding love righteous companion family life halal relationship",
  married:
    "marriage spouse husband wife harmony love blessings in marriage family life",
  spouse:
    "marriage spouse husband wife righteous partner nikah love companionship",
  wedding:
    "marriage nikah wedding blessings spouse union couple newlywed",
  husband:
    "marriage spouse husband love harmony patience marriage relationship",
  wife:
    "marriage spouse wife love harmony patience marriage relationship",
  nikah:
    "marriage nikah wedding spouse blessings righteous partner union",
  "finding love":
    "marriage finding spouse righteous partner nikah companionship loneliness single",
  lonely:
    "loneliness companionship finding spouse marriage friendship isolation sadness",
  single:
    "marriage finding spouse single looking for partner nikah companionship loneliness",

  anxiety:
    "anxiety worry stress overwhelmed mental health fear panic restlessness unease overthinking",
  anxious:
    "anxiety worry stress overwhelmed mental health fear panic restlessness",
  stressed:
    "stress anxiety pressure overwhelmed burnout difficulty hardship ease",
  stress:
    "stress anxiety pressure overwhelmed burnout difficulty hardship ease mental health",
  depressed:
    "depression sadness grief sorrow mental health hopelessness despair healing",
  depression:
    "depression sadness grief sorrow mental health hopelessness despair healing emotional pain",
  sad:
    "sadness grief sorrow depression emotional pain healing comfort relief",
  sadness:
    "sadness grief sorrow depression emotional pain healing comfort relief loss",
  grief:
    "grief loss death sadness mourning bereavement patience comfort healing",
  worried:
    "worry anxiety fear stress concern trust in Allah tawakkul overthinking",
  worry:
    "worry anxiety fear stress concern trust in Allah tawakkul overthinking",
  overwhelmed:
    "overwhelmed stress burnout difficulty ease hardship help relief support",

  forgiveness:
    "forgiveness repentance sins tawbah mercy pardon regret guilt turning back to Allah istighfar",
  forgive:
    "forgiveness repentance sins tawbah mercy pardon regret guilt turning back to Allah",
  repentance:
    "repentance tawbah forgiveness sins mercy turning back to Allah regret guilt",
  sins:
    "sins forgiveness repentance tawbah mercy guilt regret purification cleansing",

  health:
    "health healing sickness illness cure recovery body wellbeing physical ailment",
  sick:
    "sickness illness healing cure recovery health disease pain suffering",
  illness:
    "illness sickness healing cure recovery health disease pain suffering",
  healing:
    "healing sickness illness cure recovery health shifa pain relief",
  cure:
    "healing sickness illness cure recovery health shifa disease",
  pain:
    "pain suffering healing patience endurance sickness illness relief",

  exams:
    "exams study knowledge memory tests school university education learning recall success",
  exam:
    "exams study knowledge memory tests school university education learning recall success",
  study:
    "study exams knowledge memory education learning school university wisdom",
  school:
    "school education study exams knowledge learning university wisdom success",
  knowledge:
    "knowledge learning wisdom education understanding beneficial study",

  children:
    "children offspring family righteous children parenting raising kids descendants",
  child:
    "children offspring family righteous child parenting raising kids",
  family:
    "family children spouse home harmony love blessings parenting household",
  parents:
    "parents mother father family mercy gratitude honoring caring elderly",
  mother:
    "mother parents family mercy gratitude honoring birr caring",
  father:
    "father parents family mercy gratitude honoring birr caring",

  money:
    "wealth provision rizq sustenance financial barakah halal income livelihood",
  wealth:
    "wealth provision rizq sustenance financial barakah halal income livelihood prosperity",
  rizq:
    "provision rizq sustenance wealth income livelihood barakah financial security",
  provision:
    "provision rizq sustenance wealth livelihood barakah financial",
  debt:
    "debt financial burden stress money relief payment freedom",
  poverty:
    "poverty provision rizq sustenance hardship hunger financial difficulty",
  job:
    "career job work provision rizq livelihood success employment",
  career:
    "career job work provision rizq livelihood success employment profession",

  guidance:
    "guidance direction right path clarity truth hidayah straight path confusion",
  lost:
    "lost guidance direction confusion clarity purpose meaning path",
  confused:
    "confusion guidance clarity direction truth decisions wisdom discernment",
  decisions:
    "decisions istikhara guidance choices direction wisdom clarity options",
  istikhara:
    "istikhara guidance decisions choices direction seeking Allah's counsel prayer",

  protection:
    "protection safety harm evil shield refuge danger enemies",
  "evil eye":
    "evil eye protection jealousy hasad envy harm shield refuge",
  enemies:
    "enemies protection harm oppression safety justice refuge",

  anger:
    "anger self-control patience calmness wrath temper management restraint",
  angry:
    "anger self-control patience calmness wrath temper management restraint",

  sleep:
    "sleep rest night insomnia peace protection morning evening bedtime",
  morning:
    "morning adhkar remembrance daily start of day blessings protection routine",
  evening:
    "evening adhkar remembrance daily end of day blessings protection routine",

  travel:
    "travel journey safety protection destination new place moving trip",
  moving:
    "moving new home travel relocation change new place transition",

  death:
    "death good ending khatima hereafter preparation afterlife grave patience",
  afterlife:
    "hereafter afterlife paradise jannah akhirah death good ending resurrection",

  success:
    "success achievement goals victory accomplishment blessings tawfiq help",
  help:
    "help support assistance difficulty hardship ease Allah's aid relief",
  hope:
    "hope optimism future ease after hardship patience trust Allah",
  fear:
    "fear anxiety trust reliance tawakkul courage safety protection",
  trust:
    "trust tawakkul reliance on Allah surrender patience acceptance",

  ramadan:
    "ramadan fasting laylatul qadr forgiveness mercy blessings month of quran",
  fasting:
    "fasting ramadan worship patience discipline hunger reward",

  gratitude:
    "gratitude thankfulness shukr appreciation blessings contentment",
  grateful:
    "gratitude thankfulness shukr appreciation blessings contentment",
};

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DUA_INTENT_PREFIX = "du'a supplication asking Allah for: ";

/**
 * Enrich a user query with related Islamic/spiritual concepts.
 * Prefixes every query with du'a intent so embeddings bias toward supplication content, not rulings or narrative.
 * Returns the string to embed (prefix + query + optional topic expansion).
 * Zero latency—no API calls, pure lookup.
 */
export function enrichQuery(query: string): string {
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ");

  const expansions = new Set<string>();

  // Check multi-word phrases first (e.g. "evil eye", "finding love")
  for (const [phrase, expansion] of Object.entries(TOPIC_MAP)) {
    if (phrase.includes(" ") && normalized.includes(phrase)) {
      expansions.add(expansion);
    }
  }

  // Then check single words
  for (const word of words) {
    if (TOPIC_MAP[word]) {
      expansions.add(TOPIC_MAP[word]);
    }
  }

  const body = expansions.size === 0 ? query : `${query} — ${[...expansions].join(" ")}`;
  return DUA_INTENT_PREFIX + body;
}
