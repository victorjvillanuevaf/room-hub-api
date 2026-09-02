import 'multer';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { S3Service } from 'src/modules/s3/services/s3.service';
import { InjectRepository } from '@nestjs/typeorm';
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
import { AllowedImageMimeType } from '../types/allowed-image-mime.type';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    private readonly logger: Logger,
    private readonly s3Service: S3Service,
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

  async getUploadUrl(
    roomId: string,
    mimetype: AllowedImageMimeType,
  ): Promise<{ uploadUrl: string; key: string }> {
    await this.findById(roomId);

    const extension = mimetype.split('/')[1];
    const key = `room_images/${roomId}_${Date.now()}.${extension}`;
    const uploadUrl = await this.s3Service.getUploadUrl(key, mimetype);

    return { uploadUrl, key };
  }

  async confirmImageUpload(roomId: string, key: string): Promise<Room> {
    const room = await this.findById(roomId);

    if (!key.startsWith(`room_images/${roomId}_`)) {
      throw new BadRequestException('Invalid image key for this room');
    }

    if (!(await this.s3Service.fileExists(key))) {
      throw new BadRequestException(
        'Image not found in storage — upload may have failed',
      );
    }

    const previousImageUrl = room.imageUrl;
    room.imageUrl = this.s3Service.getPublicUrl(key);

    const savedRoom = await this.roomRepo.save(room);

    if (previousImageUrl) {
      await this.s3Service.deleteFile(
        this.s3Service.extractKeyFromUrl(previousImageUrl),
      );
    }

    return savedRoom;
  }
}
