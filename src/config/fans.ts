/**
 * Everything the "for the fans" experience says, in one place.
 *
 * Facts below come from public sources checked on 2026-10-20 (SiriusXM show pages and
 * SiriusXM Media / Edison audience notes). Nothing here is invented. If a show moves
 * or ends, edit `lanes[].when` / `where`.
 */

import type { ArtKey } from "./art";

/** Phrases the ticker repeats. The first two are documented on-air catchphrases. */
export const catchphrases = [
  "Blasphemous",
  "Stay off the weed",
  "Straight talk",
  "Real fans",
  "No filter",
  "Real talk",
] as const;

export type LaneId = "sports" | "politics" | "culture";

export interface Lane {
  id: LaneId;
  word: string;
  show: string;
  /** Network and channel line on the stub. Empty when the big label already says it (podcasts). */
  where: string;
  /** Human schedule line. Empty when the schedule is not public. */
  when: string;
  blurb: string;
  collection: string;
  cta: string;
  /** SiriusXM channel number printed on the ticket, when there is one. */
  channel?: number;
  /** Screen-print illustration on the ticket. */
  art: ArtKey;
  /** ET window used for the live badge. Only set when the schedule is documented. */
  live?: { days: number[]; startHour: number; endHour: number };
  /** Documented weekly start used for the countdown. 0 = Sunday. */
  next?: { day: number; hour: number };
  link?: { label: string; href: string };
}

export const SIRIUSXM_STEPHEN_A = "https://www.siriusxm.com/blog/stephen-a-smith";

export const lanes: Lane[] = [
  {
    id: "sports",
    word: "Sports",
    show: "The Stephen A. Smith Show",
    where: "Mad Dog Sports Radio · SiriusXM Ch. 82",
    when: "Mon–Fri · 1–3 PM ET",
    blurb: "Daily sports talk. Pick a side, then wear it.",
    collection: "the-stephen-a-smith-show",
    cta: "Shop the show",
    channel: 82,
    art: "mic",
    live: { days: [1, 2, 3, 4, 5], startHour: 13, endHour: 15 },
    link: { label: "Listen on SiriusXM", href: SIRIUSXM_STEPHEN_A },
  },
  {
    id: "politics",
    word: "Politics",
    show: "Straight Shooter with Stephen A.",
    where: "POTUS · SiriusXM Ch. 124",
    when: "Wednesdays · 6 PM ET live",
    blurb: "Politics and culture, live, with callers in the second half.",
    collection: "straight-shooter",
    cta: "Shop Straight Shooter",
    channel: 124,
    art: "capitol",
    next: { day: 3, hour: 18 },
    link: { label: "Listen on SiriusXM", href: SIRIUSXM_STEPHEN_A },
  },
  {
    id: "culture",
    word: "Culture",
    show: "The Culture Table",
    where: "",
    when: "",
    blurb: "Culture, unfiltered. Pull up a chair, bring the opinions.",
    collection: "the-culture-table",
    cta: "Shop Culture Table",
    art: "table",
  },
];

export interface QuizQuestion {
  prompt: string;
  answers: { label: string; lane: LaneId }[];
}

export const quiz: QuizQuestion[] = [
  {
    prompt: "It's 1 PM on a weekday. Where are you?",
    answers: [
      { label: "Arguing about last night's game", lane: "sports" },
      { label: "Reading the headlines before the call-in", lane: "politics" },
      { label: "Out with the crew, talking about everything", lane: "culture" },
    ],
  },
  {
    prompt: "Pick your debate.",
    answers: [
      { label: "Who's the real GOAT?", lane: "sports" },
      { label: "Who's actually running things?", lane: "politics" },
      { label: "What's everybody really talking about?", lane: "culture" },
    ],
  },
  {
    prompt: "How loud do you wear it?",
    answers: [
      { label: "Big. The whole block should know.", lane: "sports" },
      { label: "Clean statement. Say it with one line.", lane: "politics" },
      { label: "Subtle. For the ones who get it.", lane: "culture" },
    ],
  },
];
