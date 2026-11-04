import { describe, it, expect } from 'vitest';
import { addDays, monthOf, vnClock, vnDayKey, vnDayStart, vnHour } from './vnTime';

describe('vnTime', () => {
  it('puts 23:59 VN and 00:00 VN on different days, whatever UTC says', () => {
    expect(vnDayKey(Date.parse('2026-11-03T16:59:59Z'))).toBe('2026-11-03'); // 23:59:59 VN
    expect(vnDayKey(Date.parse('2026-11-03T17:00:00Z'))).toBe('2026-11-04'); // 00:00 VN
    expect(vnHour(Date.parse('2026-11-03T17:00:00Z'))).toBe(0);
    expect(vnClock(Date.parse('2026-11-03T15:31:40Z'))).toBe('22:31');
  });

  it('starts a day at 00:00 VN', () => {
    expect(new Date(vnDayStart('2026-11-04')).toISOString()).toBe('2026-11-03T17:00:00.000Z');
  });

  it('moves across months and years', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(monthOf('2026-11-04')).toBe('2026-11');
  });
});
