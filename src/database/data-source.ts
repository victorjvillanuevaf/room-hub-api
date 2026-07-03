import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AuthModule } from '../modules/auth/auth.module';
import { Building } from '../modules/buildings/entities/building.entity';
import { Reservation } from '../modules/reservations/entities/reservation.entity';
import { Room } from '../modules/rooms/entities/room.entity';
import { User } from '../modules/users/entities/user.entity';

void AuthModule;

export const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Building, Room, Reservation],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
});
