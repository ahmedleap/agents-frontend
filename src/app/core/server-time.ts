// Times from the backend are UTC. Most carry their offset ("...Z" or "+00:00"), but some (Java LocalDateTime)
// come without one, and the browser would read those as the computer's local time, hours off. These helpers
// read every timestamp as UTC so it can then be shown in the computer's own time zone.

const NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** The timestamp as an ISO string with a zone (unchanged if it already has one, or is a plain date) */
export function utcIso(value: string): string;
export function utcIso(value: string | null | undefined): string | null | undefined;
export function utcIso(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  return NAIVE_DATE_TIME.test(trimmed) ? `${trimmed.replace(' ', 'T')}Z` : trimmed;
}

/** The timestamp as a Date, reading one without a zone as UTC */
export function serverDate(value: string): Date {
  return new Date(utcIso(value));
}

const localDateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** e.g. "Oct 28, 2026, 1:47 PM" in the computer's time zone */
export function localTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = serverDate(value);
  return Number.isNaN(date.getTime()) ? '—' : localDateTime.format(date);
}

const newYorkOffset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' });

/** New York's offset from UTC in minutes at that moment (-240 in summer, -300 in winter) */
function newYorkOffsetMinutes(at: Date): number {
  const name = newYorkOffset.formatToParts(at).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
}

/**
 * A time that was saved as New York clock time but arrives labelled as UTC (e.g. 10:59 that should be 14:59 UTC),
 * corrected by subtracting New York's offset at that moment. Returns an ISO string in UTC.
 */
export function fromNewYorkClock(value: string): string {
  const asLabelled = serverDate(value);
  // The offset depends on the real moment; the labelled time is close enough to find it (it's off by hours, not days)
  const offset = newYorkOffsetMinutes(new Date(asLabelled.getTime() + 5 * 60 * 60 * 1000));
  return new Date(asLabelled.getTime() - offset * 60 * 1000).toISOString();
}
