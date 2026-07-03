import { DateTime } from 'luxon';
import { toLocalDateTime } from 'src/common/utils/to-local-datetime';
import { ReservationStatus } from '../types/room-details.type';

export const getReservationStatus = ({
  startAt,
  endAt,
  now,
  timezone,
}: {
  startAt: string;
  endAt: string;
  now: DateTime;
  timezone: string;
}): ReservationStatus => {
  const nowLocal = now.setZone(timezone);
  const startDateTime = toLocalDateTime(startAt, timezone);
  const endDateTime = toLocalDateTime(endAt, timezone);

  if (nowLocal < startDateTime) {
    return 'UPCOMING';
  } else if (nowLocal >= startDateTime && nowLocal <= endDateTime) {
    return 'IN_PROGRESS';
  } else {
    return 'PAST';
  }
};
