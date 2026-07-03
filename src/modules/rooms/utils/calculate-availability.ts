import { DateTime } from 'luxon';
import { Reservation } from '../types/room-details.type';
import { roundupToNearestHalfHour } from './roundup-halfhour';
import { toLocalDateTime } from 'src/common/utils/to-local-datetime';

type OperatingHours = {
  start: string;
  end: string;
};

type Parameters = {
  timezone: string;
  reservations: Reservation[];
  operatingHours: OperatingHours;
  now: DateTime;
  day: string;
};

export const calculateAvailability = ({
  timezone,
  reservations,
  operatingHours,
  now,
  day,
}: Parameters): boolean => {
  if (reservations.length === 0) return true;

  const nowLocal = now.setZone(timezone);

  const todayStr = nowLocal.toFormat('yyyy-MM-dd');
  const isToday = day === todayStr;

  const current = isToday
    ? roundupToNearestHalfHour(nowLocal)
    : DateTime.fromISO(`${day}T${operatingHours.start}:00`, { zone: timezone });

  const currentTime = current.toFormat('HH:mm');

  const upcoming = isToday
    ? reservations.filter((r) => current < toLocalDateTime(r.endAt, timezone))
    : reservations;

  if (upcoming.length === 0 && isToday) {
    return currentTime < operatingHours.end;
  }

  const first = upcoming[0];
  const last = upcoming.at(-1)!;

  if (
    currentTime > operatingHours.start &&
    current < toLocalDateTime(first.startAt, timezone)
  ) {
    return true;
  }

  if (first.startTime > operatingHours.start && first.startTime > currentTime)
    return true;

  if (last.endTime < operatingHours.end && last.endTime >= currentTime)
    return true;

  for (let i = 0; i < upcoming.length - 1; i++) {
    const currentEndMs = upcoming[i].endTime;
    const nextStartMs = upcoming[i + 1].startTime;
    if (currentEndMs !== nextStartMs) return true;
  }

  return false;
};
