const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface ShowTiming {
  date: string;
  startsAt?: number;
  endsAt?: number;
  timeZone?: string;
}

/** Require an explicit offset; never parse a provider's local clock as UTC. */
export function parseProviderTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function hasShowEnded(show: ShowTiming, now = Date.now()): boolean {
  const midnight = Date.parse(`${show.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(show.date) || !Number.isFinite(midnight) ||
    new Date(midnight).toISOString().slice(0, 10) !== show.date) return false;
  // Provider start time is authoritative. Allow six hours for a concert when
  // no end time is supplied; this is not a prediction of its actual duration.
  if (Number.isFinite(show.startsAt)) {
    const start = show.startsAt!;
    const end = Number.isFinite(show.endsAt) && show.endsAt! >= start
      ? show.endsAt! + HOUR : start + 6 * HOUR;
    return now >= end;
  }
  if (show.timeZone) {
    try {
      // Without an authoritative start time, wait until 06:00 on the next
      // venue-local day. This also handles DST and overnight performances.
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: show.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date(now));
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
      const localDate = `${get("year")}-${get("month")}-${get("day")}`;
      const nextDay = new Date(midnight + DAY).toISOString().slice(0, 10);
      return localDate > nextDay || (localDate === nextDay && Number(get("hour")) >= 6);
    } catch { /* Invalid/missing provider timezone: use the conservative fallback. */ }
  }
  // Latest possible local day (UTC-12), then six hours into the following day.
  return now >= midnight + DAY + 18 * HOUR;
}
