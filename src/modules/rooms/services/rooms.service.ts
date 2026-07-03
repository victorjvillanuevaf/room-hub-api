import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { UpdateRoomDto } from '../dto/update-room.dto';
import { Room } from '../entities/room.entity';
import { ReservationsService } from 'src/modules/reservations/services/reservations.service';
import { RoomAvailabilityDetails } from '../types/room-details.type';
import { calculateAvailability } from '../utils/calculate-availability';
import { DateTime } from 'luxon';
import { FindAllRoomsDto } from '../dto/filters.dto';
import { getReservationStatus } from '../utils/get-reservation-status';
import { PaginatedResponse } from 'src/common/types/paginated-response';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    private readonly reservationService: ReservationsService,
  ) {}

  async list(filters: FindAllRoomsDto): Promise<PaginatedResponse<Room>> {
    const { buildingId, capacity, page, limit, sortOrder } = filters;

    const normalizedPage = Math.max(page, 1);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);

    const [rooms, total] = await this.roomRepo.findAndCount({
      where: {
        ...(buildingId ? { buildingId } : {}),
        ...(capacity ? { capacity: MoreThanOrEqual(capacity) } : {}),
      },
      relations: {
        building: true,
      },
      order: {
        createdAt: sortOrder ?? 'ASC',
      },
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
    });

    return {
      data: rooms,
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit),
    };
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

  async findByBuildingId(buildingId: string): Promise<Room[]> {
    return this.roomRepo.find({
      where: { buildingId },
      relations: {
        building: true,
      },
    });
  }

  async uploadImage(
    roomId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ): Promise<Room> {
    const room = await this.findById(roomId);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PNG, JPEG, and JPG files are allowed',
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'room_images');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const sanitizedFileName = `${roomId}_${timestamp}_${file.originalname.toLowerCase().replace(/[^a-z0-9.]/g, '_')}`;
    const filePath = join(uploadsDir, sanitizedFileName);

    try {
      writeFileSync(filePath, file.buffer);

      const imageUrl = `/uploads/room_images/${sanitizedFileName}`;

      if (room.imageUrl && room.imageUrl.startsWith('/uploads/room_images/')) {
        const oldFilePath = join(process.cwd(), room.imageUrl);
        try {
          if (existsSync(oldFilePath)) {
            unlinkSync(oldFilePath);
          }
        } catch (deleteError) {
          console.warn('Could not delete old image file:', deleteError);
        }
      }

      room.imageUrl = imageUrl;
      return this.roomRepo.save(room);
    } catch {
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch (unlinkError) {
          console.error('Error deleting file on failure:', unlinkError);
        }
      }
      throw new BadRequestException('Failed to save image');
    }
  }

  async getRoomAvailabilityDetails(
    roomId: string,
    timezone: string,
  ): Promise<RoomAvailabilityDetails> {
    const room = await this.findById(roomId);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const now = DateTime.now();

    const rawRows = await this.reservationService.getReservationGroupedByDay(
      roomId,
      timezone,
    );

    const operatingHours = this.reservationService.getOperatingHours();

    const reservationsGroupedByDay = rawRows.map((row) => {
      const availability = calculateAvailability({
        timezone,
        reservations: row.reservations,
        operatingHours,
        day: row.day,
        now,
      });

      return {
        day: row.day,
        availability,
        reservations: row.reservations.map((r) => ({
          ...r,
          status: getReservationStatus({
            timezone,
            startAt: r.startAt,
            endAt: r.endAt,
            now,
          }),
        })),
      };
    });

    return {
      id: roomId,
      reservationsGroupedByDay,
    };
  }
}
