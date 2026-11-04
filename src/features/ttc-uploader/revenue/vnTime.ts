/**
 * Days and hours in Vietnam time (UTC+7, no daylight saving), whatever the time zone of
 * the computer: a revenue day runs from 00:00 to 24:00 Vietnam time.
 */

export const VN_OFFSET_MS = 7 * 3600_000;
export const DAY_MS = 24 * 3600_000;

/** `YYYY-MM-DD` of the Vietnam day containing `ts`. */
export function vnDayKey(ts: number): string {
  return new Date(ts + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hour (0–23) of `ts` in Vietnam time. */
export function vnHour(ts: number): number {
  return new Date(ts + VN_OFFSET_MS).getUTCHours();
}

/** Start (00:00 Vietnam time) of the day `key`, as epoch ms. */
export function vnDayStart(key: string): number {
  return Date.parse(`${key}T00:00:00Z`) - VN_OFFSET_MS;
}

/** `YYYY-MM` of a day key. */
export function monthOf(key: string): string {
  return key.slice(0, 7);
}

/** The day `n` days after `key` (negative: before). */
export function addDays(key: string, n: number): string {
  return vnDayKey(vnDayStart(key) + n * DAY_MS);
}

/** `HH:mm` of `ts` in Vietnam time. */
export function vnClock(ts: number): string {
  return new Date(ts + VN_OFFSET_MS).toISOString().slice(11, 16);
}

/** `dd/mm` of a day key, as the UI shows dates. */
export function shortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}
