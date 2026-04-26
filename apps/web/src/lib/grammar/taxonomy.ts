/**
 * Canonical category labels for Cambridge KET (A2) + PET (B1) grammar.
 * Slugs come from the Cambridge handbook structure inventory section names.
 *
 * 11 KET categories + 3 PET-only categories = 14 total. Topics within each
 * category are stored on `GrammarTopic` rows; this module is just the
 * category-name lookup.
 */
export const CATEGORY_LABELS = {
  // KET (11)
  tenses:         { zh: "时态",       en: "Tenses" },
  modals:         { zh: "情态动词",    en: "Modals" },
  verb_forms:     { zh: "动词形式",    en: "Verb forms" },
  clause_types:   { zh: "从句类型",    en: "Clause types" },
  interrogatives: { zh: "疑问句",      en: "Interrogatives" },
  nouns:          { zh: "名词",       en: "Nouns" },
  pronouns:       { zh: "代词",       en: "Pronouns" },
  adjectives:     { zh: "形容词",     en: "Adjectives" },
  adverbs:        { zh: "副词",       en: "Adverbs" },
  prepositions:   { zh: "介词",       en: "Prepositions" },
  connectives:    { zh: "连词",       en: "Connectives" },
  // PET adds (3)
  conditionals:    { zh: "条件句",     en: "Conditionals" },
  reported_speech: { zh: "间接引语",   en: "Reported speech" },
  phrasal_verbs:   { zh: "短语动词",   en: "Phrasal verbs" },
} as const;

export const ALL_CATEGORIES: string[] = Object.keys(CATEGORY_LABELS);

export interface CategoryLabel {
  zh: string;
  en: string;
}

/** Returns the canonical labels for a category slug. Falls back to the slug
 *  itself (zh + en both = slug) for unknown categories so the UI doesn't
 *  break if seed data drifts. */
export function getCategoryLabel(slug: string): CategoryLabel {
  if (slug in CATEGORY_LABELS) {
    return CATEGORY_LABELS[slug as keyof typeof CATEGORY_LABELS];
  }
  return { zh: slug, en: slug };
}
