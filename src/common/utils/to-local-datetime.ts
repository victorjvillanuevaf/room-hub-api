import { DateTime } from 'luxon';

export const toLocalDateTime = (date: string, timezone: string): DateTime => {
  return DateTime.fromISO(date, { zone: timezone });
};
