import { RoomsController } from 'src/modules/rooms/controllers/rooms.controller';
import { RoomsService } from 'src/modules/rooms/services/rooms.service';
import { Room } from 'src/modules/rooms/entities/room.entity';
import { FindAllRoomsDto } from 'src/modules/rooms/dto/filters.dto';
import { UpdateRoomDto } from 'src/modules/rooms/dto/update-room.dto';
import { sleep } from 'src/common/utils/sleep';

jest.mock('src/common/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const mockedSleep = sleep as jest.MockedFunction<typeof sleep>;

describe('RoomsController', () => {
  let controller: RoomsController;
  let roomsService: Partial<Record<keyof RoomsService, jest.Mock>>;

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

    roomsService = {
      list: jest.fn(),
      findById: jest.fn(),
      getRoomAvailabilityDetails: jest.fn(),
      update: jest.fn(),
      findByBuildingId: jest.fn(),
      uploadImage: jest.fn(),
    };

    controller = new RoomsController(roomsService as unknown as RoomsService);
  });

  describe('list', () => {
    it('delegates to roomsService.list and returns its result', async () => {
      const filters: FindAllRoomsDto = {
        page: 1,
        limit: 10,
      };
      const paginated = {
        data: [buildRoom()],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      };
      roomsService.list!.mockResolvedValue(paginated);

      const result = await controller.list(filters);

      expect(roomsService.list).toHaveBeenCalledWith(filters);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('delegates to roomsService.findById and returns its result', async () => {
      const room = buildRoom();
      roomsService.findById!.mockResolvedValue(room);

      const result = await controller.findById('room-1');

      expect(roomsService.findById).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(room);
    });
  });

  describe('getRoomDetails', () => {
    it('delegates to roomsService.getRoomAvailabilityDetails with the given timezone', async () => {
      const details = {
        id: 'room-1',
        reservationsGroupedByDay: [],
      };
      roomsService.getRoomAvailabilityDetails!.mockResolvedValue(details);

      const result = await controller.getRoomDetails(
        'room-1',
        'America/Bogota',
      );

      expect(roomsService.getRoomAvailabilityDetails).toHaveBeenCalledWith(
        'room-1',
        'America/Bogota',
      );
      expect(result).toEqual(details);
    });

    it('defaults the timezone to UTC when the x-timezone header is omitted', async () => {
      const details = {
        id: 'room-1',
        reservationsGroupedByDay: [],
      };
      roomsService.getRoomAvailabilityDetails!.mockResolvedValue(details);

      const result = await controller.getRoomDetails('room-1');

      expect(roomsService.getRoomAvailabilityDetails).toHaveBeenCalledWith(
        'room-1',
        'UTC',
      );
      expect(result).toEqual(details);
    });
  });

  describe('update', () => {
    it('delegates to roomsService.update and returns its result', async () => {
      const dto: UpdateRoomDto = { name: 'Updated Room' };
      const updatedRoom = buildRoom({ name: 'Updated Room' });
      roomsService.update!.mockResolvedValue(updatedRoom);

      const result = await controller.update('room-1', dto);

      expect(roomsService.update).toHaveBeenCalledWith('room-1', dto);
      expect(result).toEqual(updatedRoom);
    });
  });

  describe('findByBuildingId', () => {
    it('delegates to roomsService.findByBuildingId and returns its result', async () => {
      const rooms = [buildRoom()];
      roomsService.findByBuildingId!.mockResolvedValue(rooms);

      const result = await controller.findByBuildingId('building-1');

      expect(roomsService.findByBuildingId).toHaveBeenCalledWith('building-1');
      expect(result).toEqual(rooms);
    });

    it('returns an empty array when the service resolves with none', async () => {
      roomsService.findByBuildingId!.mockResolvedValue([]);

      const result = await controller.findByBuildingId('building-1');

      expect(result).toEqual([]);
    });
  });

  describe('uploadImage', () => {
    const file = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('image-data'),
    };

    it('sleeps before delegating to roomsService.uploadImage and returns its result', async () => {
      const room = buildRoom({ imageUrl: '/uploads/room_images/photo.png' });
      roomsService.uploadImage!.mockResolvedValue(room);

      const result = await controller.uploadImage('room-1', file);

      expect(mockedSleep).toHaveBeenCalledWith(2000);
      expect(roomsService.uploadImage).toHaveBeenCalledWith('room-1', file);
      expect(result).toEqual(room);
    });

    it('propagates errors thrown by roomsService.uploadImage', async () => {
      roomsService.uploadImage!.mockRejectedValue(
        new Error('Failed to save image'),
      );

      await expect(controller.uploadImage('room-1', file)).rejects.toThrow(
        'Failed to save image',
      );
    });
  });
});
