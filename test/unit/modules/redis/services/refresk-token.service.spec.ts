import { NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { RefreshTokenService } from 'src/modules/redis/services/refresk-token.service';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

describe('RefreshTokenService', () => {
  const buildRedis = () =>
    ({
      set: jest.fn(),
      sadd: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
    }) as unknown as Redis;

  describe('store', () => {
    it('sets the refresh token, adds it to the user session set, and refreshes the session TTL', async () => {
      const redis = buildRedis();
      const service = new RefreshTokenService(redis);

      await service.store('jti-1', 'user-1');

      expect(redis.set).toHaveBeenCalledWith(
        'refresh:jti-1',
        'user-1',
        'EX',
        SEVEN_DAYS_IN_SECONDS,
      );
      expect(redis.sadd).toHaveBeenCalledWith('user_sessions:user-1', 'jti-1');
      expect(redis.expire).toHaveBeenCalledWith(
        'user_sessions:user-1',
        SEVEN_DAYS_IN_SECONDS,
      );
    });
  });

  describe('exists', () => {
    it('returns true when the refresh token exists', async () => {
      const redis = buildRedis();
      (redis.get as jest.Mock).mockResolvedValue('user-1');
      const service = new RefreshTokenService(redis);

      const result = await service.exists('jti-1');

      expect(redis.get).toHaveBeenCalledWith('refresh:jti-1');
      expect(result).toBe(true);
    });

    it('returns false when the refresh token does not exist', async () => {
      const redis = buildRedis();
      (redis.get as jest.Mock).mockResolvedValue(null);
      const service = new RefreshTokenService(redis);

      const result = await service.exists('missing-jti');

      expect(result).toBe(false);
    });
  });

  describe('revoke', () => {
    it('deletes the refresh token and removes it from the user session set', async () => {
      const redis = buildRedis();
      const service = new RefreshTokenService(redis);

      await service.revoke('jti-1', 'user-1');

      expect(redis.del).toHaveBeenCalledWith('refresh:jti-1');
      expect(redis.srem).toHaveBeenCalledWith('user_sessions:user-1', 'jti-1');
    });
  });

  describe('revokeAllForUser', () => {
    it('deletes all refresh tokens and the session set when sessions exist', async () => {
      const redis = buildRedis();
      (redis.smembers as jest.Mock).mockResolvedValue(['jti-1', 'jti-2']);
      const service = new RefreshTokenService(redis);

      await service.revokeAllForUser('user-1');

      expect(redis.smembers).toHaveBeenCalledWith('user_sessions:user-1');
      expect(redis.del).toHaveBeenNthCalledWith(
        1,
        'refresh:jti-1',
        'refresh:jti-2',
      );
      expect(redis.del).toHaveBeenNthCalledWith(2, 'user_sessions:user-1');
      expect(redis.del).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException when no sessions exist for the user', async () => {
      const redis = buildRedis();
      (redis.smembers as jest.Mock).mockResolvedValue([]);
      const service = new RefreshTokenService(redis);

      await expect(service.revokeAllForUser('user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
