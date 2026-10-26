/**
 * US stock market (NYSE/Nasdaq) regular trading hours, worked out in the browser:
 * 9:30 AM–4:00 PM Eastern, Monday to Friday, closed on exchange holidays, 1:00 PM close on early-close days.
 * The backend has no market-clock endpoint yet; if one is added, MarketHoursService is the one place to switch over.
 */

/** NYSE full-day closures (published exchange calendar). Add the next year's dates each December. */
const HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24'
]);

/** NYSE early closes (1:00 PM Eastern) */
const EARLY_CLOSES = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);

const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;
const EARLY_CLOSE_MINUTES = 13 * 60;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface MarketStatus {
  open: boolean;
  /** e.g. "Closes 4:00 PM ET" or "Opens Monday 9:30 AM ET" */
  detail: string;
}

/** The date (YYYY-MM-DD) and minutes past midnight in New York */
function newYorkNow(now: Date): { date: string; minutes: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts['year']}-${parts['month']}-${parts['day']}`, minutes: Number(parts['hour']) * 60 + Number(parts['minute']) };
}

/** Calendar arithmetic on YYYY-MM-DD strings (time-zone free) */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isTradingDay(date: string): boolean {
  const day = weekday(date);
  return day !== 0 && day !== 6 && !HOLIDAYS.has(date);
}

function closeMinutes(date: string): number {
  return EARLY_CLOSES.has(date) ? EARLY_CLOSE_MINUTES : CLOSE_MINUTES;
}

function timeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'} ET`;
}

export function marketStatus(now: Date): MarketStatus {
  const { date, minutes } = newYorkNow(now);
  if (isTradingDay(date) && minutes >= OPEN_MINUTES && minutes < closeMinutes(date)) {
    return { open: true, detail: `Closes ${timeLabel(closeMinutes(date))}` };
  }

  // Closed: find the next session (today if it's before the open)
  let next = isTradingDay(date) && minutes < OPEN_MINUTES ? date : addDays(date, 1);
  for (let i = 0; i < 14 && !isTradingDay(next); i++) next = addDays(next, 1);
  const day = next === date ? 'today' : next === addDays(date, 1) ? 'tomorrow' : WEEKDAYS[weekday(next)];
  return { open: false, detail: `Opens ${day} ${timeLabel(OPEN_MINUTES)}` };
}
