import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { RedisModule } from './modules/redis/redis.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [join(__dirname, 'database/migrations/*{.ts,.js}')],
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = Number(config.get<string>('THROTTLE_TTL', '60000'));
        const limit = Number(config.get<string>('THROTTLE_LIMIT', '10'));

        return [
          {
            ttl: Number.isFinite(ttl) ? ttl : 60000,
            limit: Number.isFinite(limit) ? limit : 10,
          },
        ];
      },
    }),
    AuthModule,
    UsersModule,
    BuildingsModule,
    RedisModule,
    RoomsModule,
    ReservationsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
