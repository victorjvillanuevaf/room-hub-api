import { DateTime } from 'luxon';
import { getReservationStatus } from 'src/modules/rooms/utils/get-reservation-status';

describe('getReservationStatus', () => {
  const timezone = 'UTC';
  const startAt = '2026-06-14T10:00:00';
  const endAt = '2026-06-14T11:00:00';

  it('returns UPCOMING when now is before the start time', () => {
    const now = DateTime.fromISO('2026-06-14T09:00:00', { zone: timezone });

    expect(getReservationStatus({ startAt, endAt, now, timezone })).toBe(
      'UPCOMING',
    );
  });

  it('returns IN_PROGRESS when now is within the reservation window', () => {
    const now = DateTime.fromISO('2026-06-14T10:30:00', { zone: timezone });

    expect(getReservationStatus({ startAt, endAt, now, timezone })).toBe(
      'IN_PROGRESS',
    );
  });

  it('returns PAST when now is after the end time', () => {
    const now = DateTime.fromISO('2026-06-14T12:00:00', { zone: timezone });

    expect(getReservationStatus({ startAt, endAt, now, timezone })).toBe(
      'PAST',
    );
  });
});
