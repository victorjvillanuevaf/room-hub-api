import { BadRequestException, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';

import { RoomsService } from 'src/modules/rooms/services/rooms.service';
import { Room } from 'src/modules/rooms/entities/room.entity';
import { ReservationsService } from 'src/modules/reservations/services/reservations.service';
import { FindAllRoomsDto } from 'src/modules/rooms/dto/filters.dto';
import { UpdateRoomDto } from 'src/modules/rooms/dto/update-room.dto';
import { calculateAvailability } from 'src/modules/rooms/utils/calculate-availability';
import { getReservationStatus } from 'src/modules/rooms/utils/get-reservation-status';

jest.mock('fs');
jest.mock('src/modules/rooms/utils/calculate-availability');
jest.mock('src/modules/rooms/utils/get-reservation-status');

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<
  typeof writeFileSync
>;
const mockedUnlinkSync = unlinkSync as jest.MockedFunction<typeof unlinkSync>;
const mockedCalculateAvailability =
  calculateAvailability as jest.MockedFunction<typeof calculateAvailability>;
const mockedGetReservationStatus = getReservationStatus as jest.MockedFunction<
  typeof getReservationStatus
>;

describe('RoomsService', () => {
  let service: RoomsService;
  let roomRepo: Partial<Record<keyof Repository<Room>, jest.Mock>>;
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

    reservationService = {
      getReservationGroupedByDay: jest.fn(),
      getOperatingHours: jest
        .fn()
        .mockReturnValue({ start: '09:00', end: '22:00' }),
    };

    service = new RoomsService(
      roomRepo as unknown as Repository<Room>,
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

  describe('uploadImage', () => {
    const validFile = {
      originalname: 'Photo Name.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('image-data'),
    };

    it('throws NotFoundException from findById when the room does not exist', async () => {
      roomRepo.findOne!.mockResolvedValue(null);

      await expect(service.uploadImage('missing', validFile)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when no file is provided', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);

      await expect(
        service.uploadImage('room-1', undefined as unknown as typeof validFile),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.uploadImage('room-1', undefined as unknown as typeof validFile),
      ).rejects.toThrow('No file provided');
    });

    it('accepts a file even when the controller has already validated its mimetype', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      const result = await service.uploadImage('room-1', {
        ...validFile,
        mimetype: 'application/pdf',
      });

      expect(result.imageUrl).toMatch(/^\/uploads\/room_images\/room-1_/);
      expect(roomRepo.save).toHaveBeenCalled();
    });

    it('accepts a file even when the controller has already validated its size', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      const result = await service.uploadImage('room-1', {
        ...validFile,
        size: 5 * 1024 * 1024 + 1,
      });

      expect(result.imageUrl).toMatch(/^\/uploads\/room_images\/room-1_/);
      expect(roomRepo.save).toHaveBeenCalled();
    });

    it('creates the uploads directory when it does not exist', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(false);
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.uploadImage('room-1', validFile);

      expect(mockedMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('room_images'),
        { recursive: true },
      );
    });

    it('does not create the uploads directory when it already exists', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(false);
      // First call checks uploadsDir existence -> true (skip mkdir),
      // subsequent existsSync calls (old file check) default to false.
      mockedExistsSync.mockImplementation(
        (path) => typeof path === 'string' && path.endsWith('room_images'),
      );
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.uploadImage('room-1', validFile);

      expect(mockedMkdirSync).not.toHaveBeenCalled();
    });

    it('writes the file, sets a sanitized imageUrl, and saves the room', async () => {
      const room = buildRoom({ imageUrl: null });
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(true);
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      const result = await service.uploadImage('room-1', validFile);

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('room-1_'),
        validFile.buffer,
      );
      expect(result.imageUrl).toMatch(
        /^\/uploads\/room_images\/room-1_\d+_photo_name\.png$/,
      );
      expect(roomRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: result.imageUrl }),
      );
    });

    it('deletes the old image file when the room previously had one under room_images', async () => {
      const room = buildRoom({
        imageUrl: '/uploads/room_images/old-image.png',
      });
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(true);
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.uploadImage('room-1', validFile);

      expect(mockedUnlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('old-image.png'),
      );
    });

    it('does not attempt to delete the old file when it does not exist on disk', async () => {
      const room = buildRoom({
        imageUrl: '/uploads/room_images/old-image.png',
      });
      roomRepo.findOne!.mockResolvedValue(room);
      // uploadsDir exists (true) but old file existsSync returns false.
      mockedExistsSync.mockImplementation(
        (path) => typeof path === 'string' && path.endsWith('room_images'),
      );
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.uploadImage('room-1', validFile);

      expect(mockedUnlinkSync).not.toHaveBeenCalled();
    });

    it('does not attempt to delete an old file outside of room_images', async () => {
      const room = buildRoom({ imageUrl: '/some/other/path/image.png' });
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(true);
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      await service.uploadImage('room-1', validFile);

      expect(mockedUnlinkSync).not.toHaveBeenCalled();
    });

    it('swallows errors when deleting the old image fails, and still saves the new one', async () => {
      const room = buildRoom({
        imageUrl: '/uploads/room_images/old-image.png',
      });
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(true);
      mockedUnlinkSync.mockImplementationOnce(() => {
        throw new Error('cannot delete');
      });
      roomRepo.save!.mockImplementation((r) => Promise.resolve(r));

      const result = await service.uploadImage('room-1', validFile);

      expect(result.imageUrl).toBeDefined();
      expect(roomRepo.save).toHaveBeenCalled();
    });

    it('cleans up the partially written file and throws BadRequestException when writeFileSync fails', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(true);
      mockedWriteFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });

      await expect(service.uploadImage('room-1', validFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadImage('room-1', validFile)).rejects.toThrow(
        'Failed to save image',
      );
      expect(mockedUnlinkSync).toHaveBeenCalled();
      expect(roomRepo.save).not.toHaveBeenCalled();
    });

    it('does not throw when cleanup unlink also fails after a write failure', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      mockedExistsSync.mockReturnValue(true);
      mockedWriteFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });
      mockedUnlinkSync.mockImplementation(() => {
        throw new Error('cannot unlink');
      });

      await expect(service.uploadImage('room-1', validFile)).rejects.toThrow(
        'Failed to save image',
      );
    });

    it('does not try to clean up the file when it was never written', async () => {
      const room = buildRoom();
      roomRepo.findOne!.mockResolvedValue(room);
      mockedWriteFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });
      mockedExistsSync.mockReturnValue(false);

      await expect(service.uploadImage('room-1', validFile)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockedUnlinkSync).not.toHaveBeenCalled();
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
