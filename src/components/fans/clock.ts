/**
 * Minute-resolution clock for the live badges, plus helpers that read the schedule in
 * US Eastern time (where the shows are programmed), regardless of the visitor's zone.
 * Client-side only: the server snapshot is "unknown", so nothing time-dependent is
 * ever prerendered.
 */

const MINUTE = 60_000;
const HOUR = 3_600_000;

const etFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function etParts(ms: number): { day: number; hour: number; minute: number } {
  let day = 0;
  let hour = 0;
  let minute = 0;
  for (const part of etFormat.formatToParts(ms)) {
    if (part.type === "weekday") day = DAYS[part.value] ?? 0;
    else if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
  }
  return { day, hour, minute };
}

export function isLiveNow(window: { days: number[]; startHour: number; endHour: number }, now: number): boolean {
  const { day, hour } = etParts(now);
  return window.days.includes(day) && hour >= window.startHour && hour < window.endHour;
}

/** Milliseconds until the next ET weekday/hour start, or NaN if none found within 8 days. */
export function msUntilNext(next: { day: number; hour: number }, now: number): number {
  const base = Math.ceil(now / HOUR) * HOUR;
  for (let i = 0; i < 24 * 8; i++) {
    const t = base + i * HOUR;
    const p = etParts(t);
    if (p.day === next.day && p.hour === next.hour) return t - now;
  }
  return Number.NaN;
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/* ---- tiny external store so every badge shares one timer ---- */

let snapshot = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const floorMinute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

export function subscribeClock(callback: () => void) {
  listeners.add(callback);
  if (!timer) {
    snapshot = floorMinute(Date.now());
    timer = setInterval(() => {
      snapshot = floorMinute(Date.now());
      listeners.forEach((l) => l());
    }, 15_000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function getClock(): number {
  if (!snapshot) snapshot = floorMinute(Date.now());
  return snapshot;
}

export const getServerClock = () => 0;
