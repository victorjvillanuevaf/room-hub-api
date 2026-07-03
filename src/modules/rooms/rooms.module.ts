import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './controllers/rooms.controller';
import { Room } from './entities/room.entity';
import { RoomsService } from './services/rooms.service';
import { ReservationsService } from '../reservations/services/reservations.service';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationsGateway } from '../reservations/gateway/reservation.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Reservation])],
  controllers: [RoomsController],
  providers: [RoomsService, ReservationsService, ReservationsGateway],
  exports: [TypeOrmModule],
})
export class RoomsModule {}
