import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';

import { RoomsService } from 'src/modules/rooms/services/rooms.service';
import { Room } from 'src/modules/rooms/entities/room.entity';
import { ReservationsService } from 'src/modules/reservations/services/reservations.service';
import { S3Service } from 'src/modules/s3/services/s3.service';
import { FindAllRoomsDto } from 'src/modules/rooms/dto/filters.dto';
import { UpdateRoomDto } from 'src/modules/rooms/dto/update-room.dto';
import { calculateAvailability } from 'src/modules/rooms/utils/calculate-availability';
import { getReservationStatus } from 'src/modules/rooms/utils/get-reservation-status';

jest.mock('src/modules/rooms/utils/calculate-availability');
jest.mock('src/modules/rooms/utils/get-reservation-status');
const mockedCalculateAvailability =
  calculateAvailability as jest.MockedFunction<typeof calculateAvailability>;
const mockedGetReservationStatus = getReservationStatus as jest.MockedFunction<
  typeof getReservationStatus
>;

describe('RoomsService', () => {
  let service: RoomsService;
  let roomRepo: Partial<Record<keyof Repository<Room>, jest.Mock>>;
  let logger: { warn: jest.Mock };
  let s3Service: Partial<Record<keyof S3Service, jest.Mock>>;
  let reservationService: Partial<Record<keyof ReservationsService, jest.Mock>>;

  const buildRoom = (overrides: Partial<Room> = {}): Room =>
    ({
      id: 'room-1',
      buildingId: 'building-1',
      name: 'Room 1',
      capacity: 10,
      imageUrl: null,
      reservations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Room;

  beforeEach(() => {
    jest.clearAllMocks();

    roomRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      preload: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    logger = {
      warn: jest.fn(),
    };

    s3Service = {
      getUploadUrl: jest.fn(),
      fileExists: jest.fn(),
      getPublicUrl: jest.fn(),
      deleteFile: jest.fn(),
      extractKeyFromUrl: jest.fn(),
    };

    reservationService = {
      getReservationGroupedByDay: jest.fn(),
      getOperatingHours: jest
        .fn()
        .mockReturnValue({ start: '09:00', end: '22:00' }),
    };

    service = new RoomsService(
      roomRepo as unknown as Repository<Room>,
      logger as never,
      s3Service as S3Service,
      reservationService as unknown as ReservationsService,
    );
  });

  describe('list', () => {
    const baseFilters: FindAllRoomsDto = {
      page: 1,
      limit: 10,
    };

    it('builds the where clause without buildingId or capacity when not provided', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list(baseFilters);

      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('includes buildingId in the where clause when provided', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list({
        ...baseFilters,
        buildingId: 'building-1',
      });

      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { buildingId: 'building-1' },
        }),
      );
    });

    it('includes capacity as MoreThanOrEqual in the where clause when provided', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list({
        ...baseFilters,
        capacity: 5,
      });

      const callArgs = roomRepo.findAndCount!.mock.calls[0][0];
      expect(callArgs.where.capacity).toBeDefined();
      expect(callArgs.where.capacity._type).toBe('moreThanOrEqual');
      expect(callArgs.where.capacity._value).toBe(5);
    });

    it('normalizes page to a minimum of 1', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      const result = await service.list({
        ...baseFilters,
        page: 0,
      });

      expect(result.page).toBe(1);
      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it('normalizes a negative page to a minimum of 1', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      const result = await service.list({
        ...baseFilters,
        page: -5,
      });

      expect(result.page).toBe(1);
    });

    it('clamps limit to a minimum of 1', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      const result = await service.list({
        ...baseFilters,
        limit: 0,
      });

      expect(result.limit).toBe(1);
    });

    it('clamps limit to a maximum of 100', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      const result = await service.list({
        ...baseFilters,
        limit: 500,
      });

      expect(result.limit).toBe(100);
    });

    it('calculates skip/take based on normalized page and limit', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list({
        ...baseFilters,
        page: 3,
        limit: 20,
      });

      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it('defaults sortOrder to ASC when not provided', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list(baseFilters);

      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'ASC' } }),
      );
    });

    it('uses the provided sortOrder when given', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list({
        ...baseFilters,
        sortOrder: 'DESC',
      });

      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('returns the paginated shape with data, page, limit, total and totalPages', async () => {
      const rooms = [buildRoom(), buildRoom({ id: 'room-2' })];
      roomRepo.findAndCount!.mockResolvedValue([rooms, 25]);

      const result = await service.list({
        ...baseFilters,
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        data: rooms,
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('requests the building relation', async () => {
      roomRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.list(baseFilters);

      expect(roomRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ relations: { building: true } }),
      );
    });
  });

  describe('findById', () => {
    it('returns the room when found', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);

      const result = await service.findById('room-1');

      expect(result).toEqual(room);
      expect(roomRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        relations: { building: true },
      });
    });

    it('throws NotFoundException when the room is not found', async () => {
      roomRepo.findOne!.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('missing')).rejects.toThrow(
        'Room not found',
      );
    });
  });

  describe('update', () => {
    it('preloads and saves the room when it exists', async () => {
      const dto: UpdateRoomDto = { name: 'Updated Room' };
      const preloaded = buildRoom({ name: 'Updated Room' });
      roomRepo.preload!.mockResolvedValue(preloaded);
      roomRepo.save!.mockResolvedValue(preloaded);

      const result = await service.update('room-1', dto);

      expect(roomRepo.preload).toHaveBeenCalledWith({
        id: 'room-1',
        ...dto,
      });
      expect(roomRepo.save).toHaveBeenCalledWith(preloaded);
      expect(result).toEqual(preloaded);
    });

    it('throws NotFoundException when preload resolves undefined', async () => {
      roomRepo.preload!.mockResolvedValue(undefined);

      await expect(service.update('missing', {})).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('missing', {})).rejects.toThrow(
        'Room not found',
      );
      expect(roomRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when preload resolves null', async () => {
      roomRepo.preload!.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByBuildingId', () => {
    it('delegates to repo.find with the building where clause and relations', async () => {
      const rooms = [buildRoom()];
      roomRepo.find!.mockResolvedValue(rooms);

      const result = await service.findByBuildingId('building-1');

      expect(roomRepo.find).toHaveBeenCalledWith({
        where: { buildingId: 'building-1' },
        relations: { building: true },
      });
      expect(result).toEqual(rooms);
    });

    it('returns an empty array when there are no rooms', async () => {
      roomRepo.find!.mockResolvedValue([]);

      const result = await service.findByBuildingId('building-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUploadUrl', () => {
    it('throws NotFoundException when room does not exist', async () => {
      roomRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.getUploadUrl('missing', 'image/png'),
      ).rejects.toThrow(NotFoundException);
      expect(s3Service.getUploadUrl).not.toHaveBeenCalled();
    });

    it('builds key and delegates to s3Service', async () => {
      roomRepo.findOne!.mockResolvedValue(buildRoom());
      s3Service.getUploadUrl!.mockResolvedValue('https://signed-url');
      jest.spyOn(Date, 'now').mockReturnValue(1718300000000);

      const result = await service.getUploadUrl('room-1', 'image/jpeg');

      expect(s3Service.getUploadUrl).toHaveBeenCalledWith(
        'room_images/room-1_1718300000000.jpeg',
        'image/jpeg',
      );
      expect(result).toEqual({
        uploadUrl: 'https://signed-url',
        key: 'room_images/room-1_1718300000000.jpeg',
      });
    });
  });

  describe('confirmImageUpload', () => {
    it('throws when key does not match room prefix', async () => {
      roomRepo.findOne!.mockResolvedValue(buildRoom());

      await expect(
        service.confirmImageUpload('room-1', 'room_images/other_123.png'),
      ).rejects.toThrow(BadRequestException);
      expect(roomRepo.save).not.toHaveBeenCalled();
    });

    it('throws when object is missing in S3', async () => {
      roomRepo.findOne!.mockResolvedValue(buildRoom());
      s3Service.fileExists!.mockResolvedValue(false);

      await expect(
        service.confirmImageUpload('room-1', 'room_images/room-1_123.png'),
      ).rejects.toThrow('Image not found in storage');
      expect(roomRepo.save).not.toHaveBeenCalled();
    });

    it('saves room image using public URL', async () => {
      const room = buildRoom({ imageUrl: null });
      roomRepo.findOne!.mockResolvedValue(room);
      s3Service.fileExists!.mockResolvedValue(true);
      s3Service.getPublicUrl!.mockReturnValue(
        'https://bucket.s3.us-east-1.amazonaws.com/room_images/room-1_123.png',
      );
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      const result = await service.confirmImageUpload(
        'room-1',
        'room_images/room-1_123.png',
      );

      expect(roomRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl:
            'https://bucket.s3.us-east-1.amazonaws.com/room_images/room-1_123.png',
        }),
      );
      expect(result.imageUrl).toBe(
        'https://bucket.s3.us-east-1.amazonaws.com/room_images/room-1_123.png',
      );
    });

    it('deletes previous image after saving the new one', async () => {
      const room = buildRoom({
        imageUrl: 'https://bucket.s3/room_images/old.png',
      });
      roomRepo.findOne!.mockResolvedValue(room);
      s3Service.fileExists!.mockResolvedValue(true);
      s3Service.getPublicUrl!.mockReturnValue(
        'https://bucket.s3/room_images/new.png',
      );
      s3Service.extractKeyFromUrl!.mockReturnValue('room_images/old.png');
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.confirmImageUpload('room-1', 'room_images/room-1_123.png');

      expect(s3Service.extractKeyFromUrl).toHaveBeenCalledWith(
        'https://bucket.s3/room_images/old.png',
      );
      expect(s3Service.deleteFile).toHaveBeenCalledWith('room_images/old.png');
    });

    it('does not delete previous image when it was empty', async () => {
      roomRepo.findOne!.mockResolvedValue(buildRoom({ imageUrl: null }));
      s3Service.fileExists!.mockResolvedValue(true);
      s3Service.getPublicUrl!.mockReturnValue(
        'https://bucket.s3/room_images/new.png',
      );
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.confirmImageUpload('room-1', 'room_images/room-1_123.png');

      expect(s3Service.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('getRoomAvailabilityDetails', () => {
    it('throws NotFoundException when the room does not exist', async () => {
      roomRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.getRoomAvailabilityDetails('missing', 'UTC'),
      ).rejects.toThrow(NotFoundException);
      expect(
        reservationService.getReservationGroupedByDay,
      ).not.toHaveBeenCalled();
    });

    it('returns the shaped availability details built from the grouped rows', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);

      const rawRows = [
        {
          day: '2026-07-01',
          reservations: [
            {
              id: 'res-1',
              userId: 'user-1',
              startAt: '2026-07-01T10:00:00Z',
              endAt: '2026-07-01T11:00:00Z',
              startTime: '10:00',
              endTime: '11:00',
            },
          ],
        },
      ];
      reservationService.getReservationGroupedByDay!.mockResolvedValue(rawRows);
      mockedCalculateAvailability.mockReturnValue(true);
      mockedGetReservationStatus.mockReturnValue('UPCOMING');

      const result = await service.getRoomAvailabilityDetails(
        'room-1',
        'America/Bogota',
      );

      expect(
        reservationService.getReservationGroupedByDay,
      ).toHaveBeenCalledWith('room-1', 'America/Bogota');
      expect(reservationService.getOperatingHours).toHaveBeenCalled();
      expect(mockedCalculateAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: 'America/Bogota',
          reservations: rawRows[0].reservations,
          day: '2026-07-01',
          operatingHours: { start: '09:00', end: '22:00' },
        }),
      );
      expect(mockedGetReservationStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: 'America/Bogota',
          startAt: rawRows[0].reservations[0].startAt,
          endAt: rawRows[0].reservations[0].endAt,
        }),
      );
      expect(result).toEqual({
        id: 'room-1',
        reservationsGroupedByDay: [
          {
            day: '2026-07-01',
            availability: true,
            reservations: [
              {
                ...rawRows[0].reservations[0],
                status: 'UPCOMING',
              },
            ],
          },
        ],
      });
    });

    it('returns an empty reservationsGroupedByDay array when there are no rows', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      reservationService.getReservationGroupedByDay!.mockResolvedValue([]);

      const result = await service.getRoomAvailabilityDetails('room-1', 'UTC');

      expect(result).toEqual({
        id: 'room-1',
        reservationsGroupedByDay: [],
      });
      expect(mockedCalculateAvailability).not.toHaveBeenCalled();
    });

    it('passes a DateTime "now" value to the utility functions', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      const rawRows = [
        {
          day: '2026-07-01',
          reservations: [
            {
              id: 'res-1',
              userId: 'user-1',
              startAt: '2026-07-01T10:00:00Z',
              endAt: '2026-07-01T11:00:00Z',
              startTime: '10:00',
              endTime: '11:00',
            },
          ],
        },
      ];
      reservationService.getReservationGroupedByDay!.mockResolvedValue(rawRows);
      mockedCalculateAvailability.mockReturnValue(false);
      mockedGetReservationStatus.mockReturnValue('PAST');

      await service.getRoomAvailabilityDetails('room-1', 'UTC');

      const availabilityArgs = mockedCalculateAvailability.mock.calls[0][0];
      expect(availabilityArgs.now).toBeInstanceOf(DateTime);
    });
  });
});
