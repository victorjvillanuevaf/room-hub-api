import { DateTime } from 'luxon';

export const roundupToNearestHalfHour = (date: DateTime): DateTime => {
  const minutes = date.minute;
  const roundedMinutes = minutes < 30 ? 30 : 0;
  if (roundedMinutes === 0) {
    date = date.plus({ hours: 1 });
  }
  return date.set({ minute: roundedMinutes, second: 0, millisecond: 0 });
};
