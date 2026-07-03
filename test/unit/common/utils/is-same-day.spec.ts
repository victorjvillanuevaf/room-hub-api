import { DateTime } from 'luxon';
import { isSameDay } from 'src/common/utils/is-same-day';

describe('isSameDay', () => {
  it('returns true when both dates are the same calendar day', () => {
    const date1 = DateTime.fromISO('2026-06-14T09:00:00', { zone: 'utc' });
    const date2 = DateTime.fromISO('2026-06-14T23:00:00', { zone: 'utc' });

    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false when dates fall on different calendar days', () => {
    const date1 = DateTime.fromISO('2026-06-14T23:59:00', { zone: 'utc' });
    const date2 = DateTime.fromISO('2026-06-15T00:01:00', { zone: 'utc' });

    expect(isSameDay(date1, date2)).toBe(false);
  });
});
