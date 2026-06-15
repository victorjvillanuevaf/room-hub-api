import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './controllers/rooms.controller';
import { Room } from './entities/room.entity';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [TypeOrmModule],
})
export class RoomsModule {}
