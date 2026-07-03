import { DateTime } from 'luxon';

export const isSameDay = (date1: DateTime, date2: DateTime): boolean => {
  return date1.hasSame(date2, 'day');
};
