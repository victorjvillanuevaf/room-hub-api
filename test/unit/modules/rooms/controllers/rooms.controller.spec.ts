import { RoomsController } from 'src/modules/rooms/controllers/rooms.controller';
import { RoomsService } from 'src/modules/rooms/services/rooms.service';
import { Room } from 'src/modules/rooms/entities/room.entity';
import { FindAllRoomsDto } from 'src/modules/rooms/dto/filters.dto';
import { UpdateRoomDto } from 'src/modules/rooms/dto/update-room.dto';
import { GetUploadUrlDto } from 'src/modules/rooms/dto/get-upload-url.dto';
import { ConfirmImageUploadDto } from 'src/modules/rooms/dto/confirm-image-upload.dto';
import { AllowedImageMimeType } from 'src/modules/rooms/types/allowed-image-mime.type';

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
      getUploadUrl: jest.fn(),
      confirmImageUpload: jest.fn(),
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

  describe('getUploadUrl', () => {
    it('delegates to roomsService.getUploadUrl and returns its result', async () => {
      const dto: GetUploadUrlDto = {
        mimetype: AllowedImageMimeType.PNG,
        size: 1024,
      };
      const payload = {
        uploadUrl: 'https://signed-url',
        key: 'room_images/room-1_123.png',
      };
      roomsService.getUploadUrl!.mockResolvedValue(payload);

      const result = await controller.getUploadUrl('room-1', dto);

      expect(roomsService.getUploadUrl).toHaveBeenCalledWith(
        'room-1',
        'image/png',
      );
      expect(result).toEqual(payload);
    });

    it('propagates errors thrown by roomsService.getUploadUrl', async () => {
      const dto: GetUploadUrlDto = {
        mimetype: AllowedImageMimeType.PNG,
        size: 1024,
      };
      roomsService.getUploadUrl!.mockRejectedValue(new Error('Room not found'));

      await expect(controller.getUploadUrl('room-1', dto)).rejects.toThrow(
        'Room not found',
      );
    });
  });

  describe('confirmImageUpload', () => {
    it('delegates to roomsService.confirmImageUpload and returns its result', async () => {
      const dto: ConfirmImageUploadDto = { key: 'room_images/room-1_123.png' };
      const room = buildRoom({
        imageUrl:
          'https://bucket.s3.us-east-1.amazonaws.com/room_images/room-1_123.png',
      });
      roomsService.confirmImageUpload!.mockResolvedValue(room);

      const result = await controller.confirmImageUpload('room-1', dto);

      expect(roomsService.confirmImageUpload).toHaveBeenCalledWith(
        'room-1',
        'room_images/room-1_123.png',
      );
      expect(result).toEqual(room);
    });

    it('propagates errors thrown by roomsService.confirmImageUpload', async () => {
      const dto: ConfirmImageUploadDto = { key: 'invalid-key' };
      roomsService.confirmImageUpload!.mockRejectedValue(
        new Error('Invalid image key for this room'),
      );

      await expect(
        controller.confirmImageUpload('room-1', dto),
      ).rejects.toThrow('Invalid image key for this room');
    });
  });
});
