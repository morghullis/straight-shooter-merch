/** One question of the FAQ page, as written in Shopify (Content > Metaobjects > FAQ). */
export interface FaqEntry {
  section: string;
  question: string;
  answer: string;
  /** Lower first; entries without a number come last. */
  position: number | null;
}

export interface FaqSection {
  title: string;
  items: { question: string; answer: string }[];
}

/** The entries grouped by section: entries in order of their numbers, sections in order of their first entry. */
export function groupFaqs(entries: FaqEntry[]): FaqSection[] {
  const sorted = entries
    .filter((e) => e.question.trim() && e.answer.trim())
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.question.localeCompare(b.question));
  const sections = new Map<string, FaqSection>();
  for (const { section, question, answer } of sorted) {
    const title = section.trim();
    if (!sections.has(title)) sections.set(title, { title, items: [] });
    sections.get(title)!.items.push({ question: question.trim(), answer: answer.trim() });
  }
  return [...sections.values()];
}
