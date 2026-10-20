import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { copy } from "@/config/copy";
import type { Lane } from "@/config/fans";
import { cn } from "@/lib/cn";

import { LiveStamp } from "./LiveStamp";

/** Week as printed on the ticket: Monday first. Values are `Date#getUTCDay` numbers. */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** Narrow weekday letters from the platform, using fixed reference dates (no clock involved). */
const dayLetter = (day: number) =>
  new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + day)));

function airDays(lane: Lane): number[] {
  if (lane.live) return lane.live.days;
  if (lane.next) return [lane.next.day];
  return [];
}

interface LaneTicketProps {
  lane: Lane;
  /** 1-based position, printed as the ticket number. */
  number: number;
}

/**
 * A studio pass instead of a card: cream stock with grain, a screen-print illustration,
 * the channel and air days like a printed schedule, a perforated stub with the actions,
 * and a red ink stamp when the show is actually on air.
 */
export function LaneTicket({ lane, number }: LaneTicketProps) {
  const days = airDays(lane);

  return (
    <article
      style={textureStyle("paper")}
      className="group/ticket relative flex h-full flex-col bg-cream text-[#15120c] shadow-[0_1.125rem_1.875rem_-0.75rem_rgba(0,0,0,0.7)] transition-transform duration-500 ease-out hover:-translate-y-2 hover:rotate-[0.7deg]"
    >
      <LiveStamp lane={lane} />

      {/* Top: what and when */}
      <div className="relative overflow-hidden px-6 pt-5 pb-6">
        <p className="flex items-center justify-between font-type text-[0.75rem] tracking-[0.14em] uppercase">
          <span>{copy.rundown.studioPass}</span>
          <span>No. {String(number).padStart(3, "0")}</span>
        </p>

        <Art
          name={lane.art}
          sizes="(min-width: 1326px) 10.6vw, 140px"
          className="pointer-events-none absolute top-11 right-4 h-auto w-[5.75rem] rotate-6 mix-blend-multiply transition-transform duration-500 group-hover/ticket:rotate-[10deg] group-hover/ticket:scale-105"
        />

        <p className="mt-5 flex items-end gap-2 font-display leading-[0.8] font-extrabold uppercase">
          {lane.channel ? (
            <>
              <span className="pb-1 text-[1.375rem] tracking-[0.04em]">{copy.rundown.channel}</span>
              <span className="text-[clamp(5.5rem,9vw,7.25rem)]">{lane.channel}</span>
            </>
          ) : (
            <span className="text-[clamp(4rem,6vw,5.25rem)]">{copy.rundown.podcast}</span>
          )}
        </p>

        <h3 className="mt-4 max-w-[15ch] font-display text-[2.125rem] leading-[0.92] font-extrabold tracking-[-0.01em] [word-spacing:0.05em] uppercase">
          {lane.show}
        </h3>

        {days.length > 0 && (
          <div className="mt-5">
            <p className="sr-only">{copy.rundown.daysLabel}</p>
            <ol aria-label={lane.when} className="flex gap-1">
              {WEEK.map((d) => {
                const on = days.includes(d);
                return (
                  <li
                    key={d}
                    aria-hidden="true"
                    className={cn(
                      "grid size-8 place-items-center border font-nav text-[0.8125rem] font-bold",
                      on ? "border-[#15120c] bg-[#15120c] text-cream" : "border-[#15120c]/30 text-[#15120c]/40",
                    )}
                  >
                    {dayLetter(d)}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {lane.when && <p className="mt-3 font-display text-[1.625rem] leading-none font-extrabold uppercase">{lane.when}</p>}
      </div>

      {/* Perforation, with the two notches cut into the edges */}
      <div aria-hidden="true" className="relative h-0 border-t-2 border-dashed border-[#15120c]/35">
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-black" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-black" />
      </div>

      {/* Stub: where, and the actions */}
      <div className="flex flex-1 flex-col px-6 pt-5 pb-5">
        {lane.where && <p className="font-type text-[0.75rem] tracking-[0.12em] uppercase">{lane.where}</p>}
        <p className={cn("text-[0.875rem] leading-relaxed text-[#15120c]/75", lane.where && "mt-2")}>{lane.blurb}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-5">
          <Button href={`/collections/${lane.collection}`} variant="ink" arrow>
            {lane.cta}
          </Button>
          {lane.link && (
            <Button href={lane.link.href} variant="ghost" size="none" className="min-h-10 text-[0.8125rem] hover:text-[#8a5a00]">
              {lane.link.label}
              <span className="sr-only"> {copy.a11y.openInNewTab}</span>
            </Button>
          )}
        </div>

        <div
          aria-hidden="true"
          className="mt-5 h-7 bg-[repeating-linear-gradient(90deg,#15120c_0_0.125rem,transparent_0.125rem_0.25rem,#15120c_0.25rem_0.3125rem,transparent_0.3125rem_0.5rem,#15120c_0.5rem_0.6875rem,transparent_0.6875rem_0.8125rem)] opacity-70"
        />
      </div>
    </article>
  );
}
