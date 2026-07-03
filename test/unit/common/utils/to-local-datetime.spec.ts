import { toLocalDateTime } from 'src/common/utils/to-local-datetime';

describe('toLocalDateTime', () => {
  it('parses an ISO string into the given timezone', () => {
    const result = toLocalDateTime('2026-06-14T12:00:00Z', 'America/Bogota');

    expect(result.isValid).toBe(true);
    expect(result.zoneName).toBe('America/Bogota');
    expect(result.hour).toBe(7);
  });

  it('returns an invalid DateTime for a malformed input', () => {
    const result = toLocalDateTime('not-a-date', 'UTC');

    expect(result.isValid).toBe(false);
  });
});
