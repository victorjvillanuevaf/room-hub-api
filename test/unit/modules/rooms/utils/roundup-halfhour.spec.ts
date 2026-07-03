import { DateTime } from 'luxon';
import { roundupToNearestHalfHour } from 'src/modules/rooms/utils/roundup-halfhour';

describe('roundupToNearestHalfHour', () => {
  it('rounds up to the half hour mark when minutes are below 30', () => {
    const date = DateTime.fromISO('2026-06-14T10:10:00', { zone: 'utc' });

    const result = roundupToNearestHalfHour(date);

    expect(result.toFormat('HH:mm:ss')).toBe('10:30:00');
  });

  it('rounds up to the next hour when minutes are 30 or above', () => {
    const date = DateTime.fromISO('2026-06-14T10:45:00', { zone: 'utc' });

    const result = roundupToNearestHalfHour(date);

    expect(result.toFormat('HH:mm:ss')).toBe('11:00:00');
  });

  it('keeps the hour when minutes are exactly 0', () => {
    const date = DateTime.fromISO('2026-06-14T10:00:00', { zone: 'utc' });

    const result = roundupToNearestHalfHour(date);

    expect(result.toFormat('HH:mm:ss')).toBe('10:30:00');
  });
});
