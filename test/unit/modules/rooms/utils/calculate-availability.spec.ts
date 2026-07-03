import { DateTime } from 'luxon';
import { calculateAvailability } from 'src/modules/rooms/utils/calculate-availability';
import { Reservation } from 'src/modules/rooms/types/room-details.type';

const timezone = 'UTC';
const operatingHours = { start: '09:00', end: '22:00' };

const makeReservation = (
  startTime: string,
  endTime: string,
  day = '2026-06-14',
): Reservation => ({
  id: `${startTime}-${endTime}`,
  userId: 'user-1',
  startAt: `${day}T${startTime}:00`,
  endAt: `${day}T${endTime}:00`,
  startTime,
  endTime,
  status: 'UPCOMING',
});

describe('calculateAvailability', () => {
  it('is available when there are no reservations at all', () => {
    const now = DateTime.fromISO('2026-06-14T08:00:00', { zone: timezone });

    expect(
      calculateAvailability({
        timezone,
        reservations: [],
        day: '2026-06-20',
        now,
        operatingHours,
      }),
    ).toBe(true);
  });

  it('honors a custom operatingHours.end instead of the default 22:00', () => {
    const day = '2026-06-20';
    const now = DateTime.fromISO('2026-06-20T19:50:00', { zone: timezone });
    // Already-ended reservation, filtered out of "upcoming" for today.
    const reservations = [makeReservation('09:00', '10:00', day)];

    expect(
      calculateAvailability({
        timezone,
        reservations,
        day,
        now,
        operatingHours,
      }),
    ).toBe(true); // rounds to 20:00, which is before the default 22:00 close

    expect(
      calculateAvailability({
        timezone,
        reservations,
        day,
        now,
        operatingHours: { start: '09:00', end: '19:00' },
      }),
    ).toBe(false); // 20:00 is after a 19:00 close
  });

  describe('future day (not today)', () => {
    const now = DateTime.fromISO('2026-06-14T08:00:00', { zone: timezone });
    const day = '2026-06-20';

    it('is available when there is a gap before the first reservation', () => {
      const reservations = [makeReservation('10:00', '11:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });

    it('is available when the last reservation ends before closing time', () => {
      const reservations = [makeReservation('09:00', '10:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });

    it('is available when there is a gap between two reservations', () => {
      const reservations = [
        makeReservation('09:00', '11:00', day),
        makeReservation('12:00', '14:00', day),
        makeReservation('14:00', '22:00', day),
      ];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });

    it('is not available when reservations cover the whole day with no gaps', () => {
      const reservations = [
        makeReservation('09:00', '15:00', day),
        makeReservation('15:00', '22:00', day),
      ];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(false);
    });
  });

  describe('today', () => {
    const day = '2026-06-14';

    it('is available when now is before opening and before the first reservation', () => {
      const now = DateTime.fromISO('2026-06-14T08:00:00', { zone: timezone });
      const reservations = [makeReservation('10:00', '11:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });

    it('is available when now falls inside a reservation that ends before closing', () => {
      const now = DateTime.fromISO('2026-06-14T10:05:00', { zone: timezone });
      const reservations = [makeReservation('09:00', '11:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });

    it('is available when all reservations already ended and closing time has not passed', () => {
      const now = DateTime.fromISO('2026-06-14T11:00:00', { zone: timezone });
      const reservations = [makeReservation('09:00', '10:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });

    it('is not available when all reservations ended and closing time already passed', () => {
      const now = DateTime.fromISO('2026-06-14T21:45:00', { zone: timezone });
      const reservations = [makeReservation('09:00', '10:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(false);
    });

    it('is available when there is a gap before an upcoming reservation', () => {
      const now = DateTime.fromISO('2026-06-14T10:05:00', { zone: timezone });
      const reservations = [makeReservation('11:00', '12:00', day)];

      expect(
        calculateAvailability({
          timezone,
          reservations,
          day,
          now,
          operatingHours,
        }),
      ).toBe(true);
    });
  });
});
