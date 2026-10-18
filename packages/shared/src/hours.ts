import { timezoneOf } from "./symbols";
import type { Exchange } from "./types";

// Regular trading sessions in exchange-local minutes since midnight.
// Public holidays are not modelled: use the provider's marketState for display.
const SESSIONS: Record<Exchange, [number, number][]> = {
  US: [[9 * 60 + 30, 16 * 60]],
  SGX: [[9 * 60, 12 * 60], [13 * 60, 17 * 60]],
  EPA: [[9 * 60, 17 * 60 + 30]],
};

export type SessionStatus = "open" | "break" | "closed";

function localClock(exchange: Exchange, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezoneOf(exchange),
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Whether an exchange is in its regular session at `now` (weekends closed, holidays ignored). */
export function sessionStatus(exchange: Exchange, now: Date = new Date()): SessionStatus {
  const { weekday, minutes } = localClock(exchange, now);
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const sessions = SESSIONS[exchange];
  if (sessions.some(([start, end]) => minutes >= start && minutes < end)) return "open";
  const first = sessions[0][0];
  const last = sessions[sessions.length - 1][1];
  return minutes >= first && minutes < last ? "break" : "closed";
}

/** How often to poll quotes: fast while trading, slow otherwise. */
export function pollInterval(exchange: Exchange, now: Date = new Date()): number {
  return sessionStatus(exchange, now) === "open" ? 30_000 : 5 * 60_000;
}
