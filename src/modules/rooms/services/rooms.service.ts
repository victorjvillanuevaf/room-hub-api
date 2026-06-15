import { Injectable, NotFoundException } from '@nestjs/common';
import { Room } from '../entities/room.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateRoomDto } from '../dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
  ) {}

  list(): Promise<Room[]> {
    return this.roomRepo.find({
      relations: {
        building: true,
      },
    });
  }

  async findById(id: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { id },
      relations: {
        building: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async update(id: string, updateData: UpdateRoomDto): Promise<Room> {
    const room = await this.roomRepo.preload({
      id,
      ...updateData,
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.roomRepo.save(room);
  }
}
