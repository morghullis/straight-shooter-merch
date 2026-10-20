"use client";

import { useSyncExternalStore } from "react";

import { Art } from "@/components/ui/Art";
import { copy } from "@/config/copy";
import type { Lane } from "@/config/fans";

import { formatCountdown, getClock, getServerClock, isLiveNow, msUntilNext, subscribeClock } from "./clock";

/**
 * Red "ON AIR" ink stamp when a documented live window is open, a black countdown tag when
 * a documented show starts within 24 hours, and nothing otherwise (we never guess an end
 * time). Reads the Eastern-time schedule, so it is right wherever the visitor is.
 */
export function LiveStamp({ lane }: { lane: Lane }) {
  const now = useSyncExternalStore(subscribeClock, getClock, getServerClock);
  if (!now) return null;

  if (lane.live && isLiveNow(lane.live, now)) {
    return (
      <div role="status" className="pointer-events-none absolute -top-4 -right-3 z-[3] w-[9.375rem] -rotate-12 sm:w-[10.625rem]">
        <Art name="stampOnAir" sizes="(min-width: 1326px) 12.8vw, 170px" className="h-auto w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]" />
        <span className="sr-only">{copy.rundown.onAirNow}</span>
      </div>
    );
  }

  if (lane.next) {
    const ms = msUntilNext(lane.next, now);
    if (Number.isFinite(ms) && ms > 0 && ms < 24 * 3_600_000) {
      return (
        <p className="pointer-events-none absolute top-4 right-4 z-[3] rotate-2 bg-[#15120c] px-3 py-1.5 font-type text-[0.75rem] tracking-[0.08em] text-gold uppercase">
          {copy.rundown.liveIn(formatCountdown(ms))}
        </p>
      );
    }
  }

  return null;
}
