import Redis from 'ioredis';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis.module';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class RefreshTokenService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async store(jti: string, userId: string): Promise<void> {
    await this.redis.set(`refresh:${jti}`, userId, 'EX', SEVEN_DAYS_IN_SECONDS);
    await this.redis.sadd(`user_sessions:${userId}`, jti);
    await this.redis.expire(`user_sessions:${userId}`, SEVEN_DAYS_IN_SECONDS);
  }

  async exists(jti: string): Promise<boolean> {
    const result = await this.redis.get(`refresh:${jti}`);
    return result !== null;
  }

  async revoke(jti: string, userId: string): Promise<void> {
    await this.redis.del(`refresh:${jti}`);
    await this.redis.srem(`user_sessions:${userId}`, jti);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    console.log(`Revoking all sessions for user ${userId}`);
    const jtis = await this.redis.smembers(`user_sessions:${userId}`);

    if (jtis.length > 0) {
      const keys = jtis.map((jti) => `refresh:${jti}`);
      await this.redis.del(...keys);
    } else {
      throw new NotFoundException(`No sessions found for user ${userId}`);
    }

    await this.redis.del(`user_sessions:${userId}`);
  }
}
