import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/entities/room.entity';
import { ReservationsController } from './controllers/reservations.controller';
import { Reservation } from './entities/reservation.entity';
import { ReservationsService } from './services/reservations.service';
import { ReservationsGateway } from './gateway/reservation.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Room])],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsGateway],
  exports: [TypeOrmModule, ReservationsService],
})
export class ReservationsModule {}
