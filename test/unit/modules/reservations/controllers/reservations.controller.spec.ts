import type { Request } from 'express';
import { ReservationsController } from 'src/modules/reservations/controllers/reservations.controller';
import { ReservationsService } from 'src/modules/reservations/services/reservations.service';
import { CreateReservationDto } from 'src/modules/reservations/dto/create-reservation.dto';
import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enum/user.enum';

type AuthenticatedRequest = Request & { user: User };

describe('ReservationsController', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'user@example.com',
    password: 'hashed-password',
    name: 'John Doe',
    role: UserRole.USER,
    reservations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildRequest = (user: User): AuthenticatedRequest =>
    ({ user }) as AuthenticatedRequest;

  let reservationsService: jest.Mocked<ReservationsService>;
  let controller: ReservationsController;

  beforeEach(() => {
    reservationsService = {
      findAllByUser: jest.fn(),
      findAllByRoom: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      getOperatingHours: jest.fn(),
    } as unknown as jest.Mocked<ReservationsService>;

    controller = new ReservationsController(reservationsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findAllByUser', () => {
    it('uses query.userId when the requester is an admin and supplies one', async () => {
      const admin = buildUser({ id: 'admin-1', role: UserRole.ADMIN });
      const request = buildRequest(admin);
      const expected = {
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      };
      reservationsService.findAllByUser.mockResolvedValue(expected);

      const result = await controller.findAllByUser(request, {
        userId: 'target-user',
        page: 1,
        limit: 10,
      });

      expect(reservationsService.findAllByUser).toHaveBeenCalledWith({
        userId: 'target-user',
        page: 1,
        limit: 10,
        sortOrder: undefined,
      });
      expect(result).toBe(expected);
    });

    it('falls back to the admin own id when query.userId is not provided', async () => {
      const admin = buildUser({ id: 'admin-1', role: UserRole.ADMIN });
      const request = buildRequest(admin);
      reservationsService.findAllByUser.mockResolvedValue({} as any);

      await controller.findAllByUser(request, { page: 1, limit: 10 });

      expect(reservationsService.findAllByUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1' }),
      );
    });

    it('always uses the requester own id for a non-admin, ignoring query.userId', async () => {
      const user = buildUser({ id: 'user-1', role: UserRole.USER });
      const request = buildRequest(user);
      reservationsService.findAllByUser.mockResolvedValue({} as any);

      await controller.findAllByUser(request, {
        userId: 'someone-else',
        page: 2,
        limit: 5,
        sortOrder: 'ASC',
      } as any);

      expect(reservationsService.findAllByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        page: 2,
        limit: 5,
        sortOrder: 'ASC',
      });
    });
  });

  describe('findAllByRoom', () => {
    it('delegates to reservationsService.findAllByRoom', async () => {
      const expected = {
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      };
      reservationsService.findAllByRoom.mockResolvedValue(expected);
      const query = {
        roomId: 'room-1',
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      } as any;

      const result = await controller.findAllByRoom(query);

      expect(reservationsService.findAllByRoom).toHaveBeenCalledWith({
        roomId: 'room-1',
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      });
      expect(result).toBe(expected);
    });
  });

  describe('getOperatingHours', () => {
    it('delegates to reservationsService.getOperatingHours', () => {
      const expected = { start: '09:00', end: '22:00' };
      reservationsService.getOperatingHours.mockReturnValue(expected);

      const result = controller.getOperatingHours();

      expect(reservationsService.getOperatingHours).toHaveBeenCalled();
      expect(result).toBe(expected);
    });
  });

  describe('create', () => {
    it('delegates to reservationsService.create with the authenticated user', async () => {
      const user = buildUser();
      const request = buildRequest(user);
      const dto: CreateReservationDto = {
        roomId: 'room-1',
        startAt: '2026-06-14T14:00:00.000Z',
        endAt: '2026-06-14T15:00:00.000Z',
      };
      const expected = { id: 'reservation-1' };
      reservationsService.create.mockResolvedValue(expected as any);

      const result = await controller.create(request, dto);

      expect(reservationsService.create).toHaveBeenCalledWith(user, dto);
      expect(result).toBe(expected);
    });
  });

  describe('cancel', () => {
    it('delegates to reservationsService.cancel with the authenticated user', async () => {
      const user = buildUser();
      const request = buildRequest(user);
      const expected = { id: 'reservation-1', status: 'CANCELLED' };
      reservationsService.cancel.mockResolvedValue(expected as any);

      const result = await controller.cancel('reservation-1', request);

      expect(reservationsService.cancel).toHaveBeenCalledWith(
        'reservation-1',
        user,
      );
      expect(result).toBe(expected);
    });
  });
});
