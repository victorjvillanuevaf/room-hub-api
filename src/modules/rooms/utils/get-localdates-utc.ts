import { DateTime } from 'luxon';

const MAX_DAYS_AHEAD = 80;

export const getLocalDayBoundsInUTC = (timezone: string) => {
  const startUtc = DateTime.now().setZone(timezone).startOf('day').toUTC();

  const endUtc = startUtc.plus({ days: MAX_DAYS_AHEAD });

  return {
    startUtc,
    endUtc,
  };
};
