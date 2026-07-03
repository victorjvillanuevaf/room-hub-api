import { DateTime } from 'luxon';
import { getLocalDayBoundsInUTC } from 'src/modules/rooms/utils/get-localdates-utc';

describe('getLocalDayBoundsInUTC', () => {
  it('returns a UTC range starting at local midnight spanning 80 days', () => {
    const { startUtc, endUtc } = getLocalDayBoundsInUTC('America/Bogota');

    const expectedStart = DateTime.now()
      .setZone('America/Bogota')
      .startOf('day')
      .toUTC();

    expect(startUtc.toISO()).toBe(expectedStart.toISO());
    expect(endUtc.diff(startUtc, 'days').days).toBe(80);
  });

  it('produces different bounds for different timezones', () => {
    const bogota = getLocalDayBoundsInUTC('America/Bogota');
    const tokyo = getLocalDayBoundsInUTC('Asia/Tokyo');

    expect(bogota.startUtc.toISO()).not.toBe(tokyo.startUtc.toISO());
  });
});
