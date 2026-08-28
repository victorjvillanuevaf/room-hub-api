import 'multer';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, unlink, writeFile } from 'fs/promises';
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
    private readonly logger: Logger,
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

  async uploadImage(roomId: string, file: Express.Multer.File): Promise<Room> {
    const room = await this.findById(roomId);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'room_images');
    await mkdir(uploadsDir, { recursive: true }); // no falla si ya existe, no hace falta existsSync

    const timestamp = Date.now();
    const sanitizedFileName = `${roomId}_${timestamp}_${file.originalname.toLowerCase().replace(/[^a-z0-9.]/g, '_')}`;
    const filePath = join(uploadsDir, sanitizedFileName);
    const previousImageUrl = room.imageUrl;

    try {
      await writeFile(filePath, file.buffer);
    } catch (writeError) {
      this.logger.error(
        `Failed to write image file at ${filePath}`,
        writeError,
      );
      throw new BadRequestException('Failed to save image');
    }

    room.imageUrl = `/uploads/room_images/${sanitizedFileName}`;

    try {
      const savedRoom = await this.roomRepo.save(room);

      if (previousImageUrl?.startsWith('/uploads/room_images/')) {
        const oldFilePath = join(process.cwd(), previousImageUrl);
        try {
          await unlink(oldFilePath);
        } catch (deleteError: unknown) {
          if ((deleteError as { code?: string })?.code !== 'ENOENT') {
            this.logger.warn(
              `Could not delete old image file at ${oldFilePath}`,
              deleteError,
            );
          }
        }
      }

      return savedRoom;
    } catch (saveError) {
      try {
        await unlink(filePath);
      } catch (unlinkError: unknown) {
        if ((unlinkError as { code?: string })?.code !== 'ENOENT') {
          this.logger.error(
            `Error deleting file on failure: ${filePath}`,
            unlinkError,
          );
        }
      }
      this.logger.error('Failed to persist room after image upload', saveError);
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
