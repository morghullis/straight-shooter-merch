"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { copy } from "@/config/copy";
import { lanes, quiz, type LaneId } from "@/config/fans";
import { cn } from "@/lib/cn";

export interface QuizPick {
  handle: string;
  title: string;
  price: string;
  image: string;
  alt: string;
}

/** The hand-drawn X that fills a ballot box. */
function Cross({ draw }: { draw: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-full" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <motion.path
        d="M5 5.5 19 19"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
      <motion.path
        d="M19.5 5 5.5 18.5"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, ease: "easeOut", delay: 0.18 }}
      />
    </svg>
  );
}

/**
 * Three questions on a paper ballot. You mark a box (the X is drawn in), the next question
 * slides in, and the result recommends real products from the catalog.
 */
export function FanQuiz({ picks }: { picks: Record<LaneId, QuizPick[]> }) {
  const motionOn = useMotionEnabled();
  const [answers, setAnswers] = useState<LaneId[]>([]);
  const [marked, setMarked] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const step = answers.length;
  const done = step >= quiz.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  // Move focus to the new question/result only when the step really changes.
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus();
  }, [step]);

  const choose = (index: number, lane: LaneId) => {
    if (marked !== null) return;
    setMarked(index);
    timer.current = setTimeout(
      () => {
        setAnswers((prev) => [...prev, lane]);
        setMarked(null);
      },
      motionOn ? 560 : 0,
    );
  };

  const resultLane = (() => {
    if (!done) return null;
    const tally = new Map<LaneId, number>();
    for (const a of answers) tally.set(a, (tally.get(a) ?? 0) + 1);
    // Highest count wins; ties go to the earliest answer.
    return [...tally.entries()].sort((x, y) => y[1] - x[1] || answers.indexOf(x[0]) - answers.indexOf(y[0]))[0][0];
  })();
  const lane = lanes.find((l) => l.id === resultLane);
  const q = quiz[Math.min(step, quiz.length - 1)];

  const slide = motionOn
    ? { initial: { opacity: 0, x: 28 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -28 } }
    : { initial: false as const, animate: {}, exit: undefined };

  return (
    <section
      aria-labelledby="quiz-title"
      style={textureStyle("paper")}
      className="relative overflow-hidden bg-cream p-6 text-[#15120c] shadow-[0_1.125rem_1.875rem_-0.75rem_rgba(0,0,0,0.7)] sm:p-8"
    >
      <div className="flex items-center justify-between font-type text-[0.75rem] tracking-[0.14em] uppercase">
        <span>{copy.quiz.kicker}</span>
        <span aria-hidden="true">No. 0001</span>
      </div>

      <h2
        id="quiz-title"
        className="mt-3 font-display text-[clamp(2.75rem,6vw,4rem)] leading-[0.9] font-extrabold [word-spacing:0.05em] uppercase"
      >
        {copy.quiz.title}
      </h2>

      {/* Progress: one numbered box per question */}
      <ol className="mt-5 flex gap-1.5" aria-hidden="true">
        {quiz.map((_, i) => (
          <li
            key={i}
            className={cn(
              "grid size-8 place-items-center border-2 font-display text-[1.0625rem] leading-none font-extrabold",
              i < step ? "border-[#15120c] bg-[#15120c] text-cream" : i === step && !done ? "border-[#15120c]" : "border-[#15120c]/30 text-[#15120c]/40",
            )}
          >
            {i + 1}
          </li>
        ))}
      </ol>

      <div className="mt-6 min-h-[20rem]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {!done ? (
            <motion.div key={`q${step}`} {...slide} transition={{ duration: 0.3 }}>
              <p className="font-type text-[0.75rem] tracking-[0.1em] text-[#15120c]/60 uppercase">
                {copy.quiz.question(step + 1, quiz.length)}
              </p>
              <h3 ref={heading} tabIndex={-1} className="mt-1 text-[1.375rem] leading-snug font-semibold outline-none">
                {q.prompt}
              </h3>

              <ul className="mt-5 space-y-2">
                {q.answers.map((a, i) => (
                  <li key={a.label}>
                    <button
                      type="button"
                      onClick={() => choose(i, a.lane)}
                      disabled={marked !== null && marked !== i}
                      className="group/answer flex w-full items-center gap-4 border-2 border-[#15120c]/20 bg-white/55 px-3 py-3 text-left text-[0.9375rem] transition-colors hover:border-[#15120c] disabled:opacity-40"
                    >
                      <span className="grid size-7 flex-none place-items-center border-2 border-[#15120c] bg-cream text-[#15120c]">
                        {marked === i && <Cross draw={motionOn} />}
                      </span>
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : (
            lane && (
              <motion.div key="result" {...slide} transition={{ duration: 0.35 }} className="relative">
                <Art
                  name="stickerOfficial"
                  sizes="(min-width: 1326px) 9vw, 120px"
                  className="pointer-events-none absolute -top-2 right-0 h-auto w-[6rem] rotate-12 drop-shadow-[0_0.375rem_0.5rem_rgba(0,0,0,0.3)]"
                />
                <p className="font-type text-[0.75rem] tracking-[0.1em] text-[#15120c]/60 uppercase">{copy.quiz.result}</p>
                <p className="mt-1 font-type text-[0.75rem] tracking-[0.1em] uppercase">{copy.quiz.yourLane}</p>
                <h3 ref={heading} tabIndex={-1} className="mt-1 font-display text-[4.5rem] leading-[0.9] font-extrabold uppercase outline-none">
                  <span className="bg-[#15120c] px-3 text-gold">{lane.word}</span>
                </h3>
                <p className="mt-3 max-w-[42ch] text-[0.9375rem] leading-relaxed text-[#15120c]/75">
                  {lane.show}. {lane.blurb}
                </p>

                <ul className="mt-5 grid grid-cols-3 gap-2">
                  {picks[lane.id].slice(0, 3).map((p) => (
                    <li key={p.handle}>
                      <Link href={`/products/${p.handle}`} className="group block">
                        <div className="relative aspect-(--card-ratio) overflow-hidden bg-sand">
                          <Image
                            src={p.image}
                            alt={p.alt}
                            fill
                            sizes="(min-width: 1326px) 10.6vw, 140px"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                          />
                        </div>
                        <p className="mt-1.5 text-[0.75rem] leading-tight group-hover:underline">{p.title}</p>
                        <p className="text-[0.75rem] text-[#15120c]/60">{p.price}</p>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Button href={`/collections/${lane.collection}`} variant="ink" arrow>
                    {lane.cta}
                  </Button>
                  <Button
                    variant="ghost"
                    size="none"
                    onClick={() => setAnswers([])}
                    className="min-h-10 text-[0.8125rem] hover:text-[#8a5a00]"
                  >
                    {copy.quiz.retake}
                  </Button>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
