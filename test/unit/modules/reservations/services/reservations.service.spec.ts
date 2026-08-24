import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError, Repository } from 'typeorm';
import { ReservationsService } from 'src/modules/reservations/services/reservations.service';
import { ReservationsGateway } from 'src/modules/reservations/gateway/reservation.gateway';
import { Reservation } from 'src/modules/reservations/entities/reservation.entity';
import { ReservationStatus } from 'src/modules/reservations/enum/reservation-status.enum';
import { Room } from 'src/modules/rooms/entities/room.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enum/user.enum';

describe('ReservationsService', () => {
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

  const buildRoom = (overrides: Partial<Room> = {}): Room =>
    ({
      id: 'room-1',
      buildingId: 'building-1',
      name: 'Room 1',
      capacity: 4,
      imageUrl: null,
      reservations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Room;

  const buildReservation = (
    overrides: Partial<Reservation> = {},
  ): Reservation =>
    ({
      id: 'reservation-1',
      roomId: 'room-1',
      userId: 'user-1',
      user: buildUser(),
      startAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: ReservationStatus.ACTIVE,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Reservation;

  const buildReservationRepo = () =>
    ({
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      query: jest.fn(),
    }) as unknown as jest.Mocked<Repository<Reservation>>;

  const buildRoomRepo = () =>
    ({
      findOne: jest.fn(),
    }) as unknown as jest.Mocked<Repository<Room>>;

  const buildGateway = () =>
    ({
      emitReservationUpdate: jest.fn(),
    }) as unknown as jest.Mocked<ReservationsGateway>;

  const buildConfig = () =>
    ({
      get: jest.fn((_key: string, def?: unknown) => def),
    }) as unknown as jest.Mocked<ConfigService>;

  let reservationRepo: jest.Mocked<Repository<Reservation>>;
  let roomRepo: jest.Mocked<Repository<Room>>;
  let gateway: jest.Mocked<ReservationsGateway>;
  let config: jest.Mocked<ConfigService>;
  let service: ReservationsService;

  beforeEach(() => {
    reservationRepo = buildReservationRepo();
    roomRepo = buildRoomRepo();
    gateway = buildGateway();
    config = buildConfig();
    service = new ReservationsService(
      reservationRepo,
      roomRepo,
      gateway,
      config,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const validDto = {
      roomId: 'room-1',
      startAt: '2026-06-14T14:00:00.000Z',
      endAt: '2026-06-14T15:00:00.000Z',
    };

    it('throws BadRequestException when startAt is not a valid date', async () => {
      const user = buildUser();

      await expect(
        service.create(user, { ...validDto, startAt: 'not-a-date' }),
      ).rejects.toThrow(
        new BadRequestException('Invalid reservation date range'),
      );
      expect(roomRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endAt is not a valid date', async () => {
      const user = buildUser();

      await expect(
        service.create(user, { ...validDto, endAt: 'not-a-date' }),
      ).rejects.toThrow(
        new BadRequestException('Invalid reservation date range'),
      );
      expect(roomRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when startAt is not earlier than endAt', async () => {
      const user = buildUser();

      await expect(
        service.create(user, {
          ...validDto,
          startAt: '2026-06-14T15:00:00.000Z',
          endAt: '2026-06-14T14:00:00.000Z',
        }),
      ).rejects.toThrow(
        new BadRequestException('startAt must be earlier than endAt'),
      );
      expect(roomRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when startAt equals endAt', async () => {
      const user = buildUser();

      await expect(
        service.create(user, {
          ...validDto,
          startAt: '2026-06-14T14:00:00.000Z',
          endAt: '2026-06-14T14:00:00.000Z',
        }),
      ).rejects.toThrow(
        new BadRequestException('startAt must be earlier than endAt'),
      );
    });

    it('throws NotFoundException when the room does not exist', async () => {
      const user = buildUser();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(user, validDto)).rejects.toThrow(
        new NotFoundException('Room not found'),
      );
      expect(roomRepo.findOne).toHaveBeenCalledWith({
        where: { id: validDto.roomId },
      });
      expect(reservationRepo.create).not.toHaveBeenCalled();
    });

    it('always uses the requesting user id for a non-admin, ignoring dto.userId', async () => {
      const user = buildUser({ id: 'user-1', role: UserRole.USER });
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation();
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      (reservationRepo.save as jest.Mock).mockResolvedValue(createdEntity);
      (reservationRepo.findOne as jest.Mock).mockResolvedValue({
        ...createdEntity,
        room,
        user: buildUser({ id: 'user-1' }),
      });

      await service.create(user, { ...validDto, userId: 'someone-else' });

      expect(reservationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('uses dto.userId when the requesting user is an admin', async () => {
      const user = buildUser({ id: 'admin-1', role: UserRole.ADMIN });
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation({ userId: 'target-user' });
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      (reservationRepo.save as jest.Mock).mockResolvedValue(createdEntity);
      (reservationRepo.findOne as jest.Mock).mockResolvedValue({
        ...createdEntity,
        room,
        user: buildUser({ id: 'target-user' }),
      });

      await service.create(user, { ...validDto, userId: 'target-user' });

      expect(reservationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'target-user' }),
      );
    });

    it('falls back to the admin user id when an admin omits dto.userId', async () => {
      const user = buildUser({ id: 'admin-1', role: UserRole.ADMIN });
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation({ userId: 'admin-1' });
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      (reservationRepo.save as jest.Mock).mockResolvedValue(createdEntity);
      (reservationRepo.findOne as jest.Mock).mockResolvedValue({
        ...createdEntity,
        room,
        user: buildUser({ id: 'admin-1' }),
      });

      await service.create(user, validDto);

      expect(reservationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1' }),
      );
    });

    it('saves the reservation, strips the user password, and emits a created event', async () => {
      const user = buildUser({ id: 'user-1', role: UserRole.USER });
      const room = buildRoom({ id: 'room-1' });
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation();
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      (reservationRepo.save as jest.Mock).mockResolvedValue(createdEntity);
      const fetchedUser = buildUser({ id: 'user-1', password: 'super-secret' });
      const fetchedReservation = {
        ...createdEntity,
        room: { ...room, building: { id: 'building-1' } },
        user: fetchedUser,
      };
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(
        fetchedReservation,
      );

      const result = await service.create(user, validDto);

      expect(reservationRepo.save).toHaveBeenCalledWith(createdEntity);
      expect(reservationRepo.findOne).toHaveBeenCalledWith({
        where: { id: createdEntity.id },
        relations: { room: { building: true }, user: true },
      });
      expect(result.user).not.toHaveProperty('password');
      expect(gateway.emitReservationUpdate).toHaveBeenCalledWith(
        result.roomId,
        { type: 'created', reservation: result },
      );
    });

    it('throws NotFoundException when the reservation cannot be re-fetched after creation', async () => {
      const user = buildUser();
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation();
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      (reservationRepo.save as jest.Mock).mockResolvedValue(createdEntity);
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(user, validDto)).rejects.toThrow(
        new NotFoundException('Reservation not found after creation'),
      );
      expect(gateway.emitReservationUpdate).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the save fails due to an overlapping reservation', async () => {
      const user = buildUser();
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation();
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      const conflictError = new QueryFailedError(
        'query',
        [],
        new Error('conflict') as any,
      );
      (conflictError as any).driverError = { code: '23P01' };
      (reservationRepo.save as jest.Mock).mockRejectedValue(conflictError);

      await expect(service.create(user, validDto)).rejects.toThrow(
        new ConflictException(
          'The room is already reserved for the selected time range',
        ),
      );
      expect(gateway.emitReservationUpdate).not.toHaveBeenCalled();
    });

    it('rethrows unrelated errors unchanged', async () => {
      const user = buildUser();
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const createdEntity = buildReservation();
      (reservationRepo.create as jest.Mock).mockReturnValue(createdEntity);
      const genericError = new Error('boom');
      (reservationRepo.save as jest.Mock).mockRejectedValue(genericError);

      await expect(service.create(user, validDto)).rejects.toBe(genericError);
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when the reservation does not exist', async () => {
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.cancel('missing-id', buildUser())).rejects.toThrow(
        new NotFoundException('Reservación no encontrada'),
      );
    });

    it('throws BadRequestException when the reservation starts within the cancellation window', async () => {
      const owner = buildUser({ id: 'user-1' });
      const reservation = buildReservation({
        userId: 'user-1',
        user: owner,
        startAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(reservation);

      await expect(service.cancel(reservation.id, owner)).rejects.toThrow(
        new BadRequestException(
          'No se puede cancelar una reservación que comienza dentro de 60 minutos',
        ),
      );
      expect(reservationRepo.save).not.toHaveBeenCalled();
    });

    it('honors a custom CANCELLATION_WINDOW_MINUTES value from config', async () => {
      const owner = buildUser({ id: 'user-1' });
      const reservation = buildReservation({
        userId: 'user-1',
        user: owner,
        startAt: new Date(Date.now() + 40 * 60 * 1000),
      });
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(reservation);
      (config.get as jest.Mock).mockReturnValueOnce(120);

      await expect(service.cancel(reservation.id, owner)).rejects.toThrow(
        new BadRequestException(
          'No se puede cancelar una reservación que comienza dentro de 120 minutos',
        ),
      );
    });

    it('throws BadRequestException when a non-admin tries to cancel someone else reservation', async () => {
      const owner = buildUser({ id: 'owner-1' });
      const requester = buildUser({ id: 'other-1', role: UserRole.USER });
      const reservation = buildReservation({
        userId: 'owner-1',
        user: owner,
        startAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(reservation);

      await expect(service.cancel(reservation.id, requester)).rejects.toThrow(
        new BadRequestException(
          'Solo puedes eliminar tus propias reservaciones',
        ),
      );
      expect(reservationRepo.save).not.toHaveBeenCalled();
    });

    it('cancels the reservation when the requester is the owner', async () => {
      const owner = buildUser({ id: 'owner-1' });
      const reservation = buildReservation({
        userId: 'owner-1',
        user: owner,
        startAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(reservation);
      const saved = { ...reservation, status: ReservationStatus.CANCELLED };
      (reservationRepo.save as jest.Mock).mockResolvedValue(saved);

      const result = await service.cancel(reservation.id, owner);

      expect(reservation.status).toBe(ReservationStatus.CANCELLED);
      expect(reservationRepo.save).toHaveBeenCalledWith(reservation);
      expect(gateway.emitReservationUpdate).toHaveBeenCalledWith(saved.roomId, {
        type: 'cancelled',
        reservation: saved,
      });
      expect(result).toBe(saved);
    });

    it('allows an admin to cancel a reservation belonging to another user', async () => {
      const owner = buildUser({ id: 'owner-1' });
      const admin = buildUser({ id: 'admin-1', role: UserRole.ADMIN });
      const reservation = buildReservation({
        userId: 'owner-1',
        user: owner,
        startAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      (reservationRepo.findOne as jest.Mock).mockResolvedValue(reservation);
      const saved = { ...reservation, status: ReservationStatus.CANCELLED };
      (reservationRepo.save as jest.Mock).mockResolvedValue(saved);

      const result = await service.cancel(reservation.id, admin);

      expect(reservationRepo.save).toHaveBeenCalledWith(reservation);
      expect(gateway.emitReservationUpdate).toHaveBeenCalledWith(saved.roomId, {
        type: 'cancelled',
        reservation: saved,
      });
      expect(result).toBe(saved);
    });
  });

  describe('findAllByUser', () => {
    it('defaults sortOrder to DESC when omitted', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.findAllByUser({
        userId: 'user-1',
        page: 1,
        limit: 10,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { startAt: 'DESC' } }),
      );
    });

    it('uses the provided sortOrder when given', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.findAllByUser({
        userId: 'user-1',
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { startAt: 'ASC' } }),
      );
    });

    it('normalizes page to at least 1', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.findAllByUser({
        userId: 'user-1',
        page: 0,
        limit: 10,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
      expect(result.page).toBe(1);
    });

    it('clamps limit to a minimum of 1', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.findAllByUser({
        userId: 'user-1',
        page: 1,
        limit: 0,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
      expect(result.limit).toBe(1);
    });

    it('clamps limit to a maximum of 100', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.findAllByUser({
        userId: 'user-1',
        page: 1,
        limit: 500,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
      expect(result.limit).toBe(100);
    });

    it('calculates skip from the normalized page and limit', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.findAllByUser({
        userId: 'user-1',
        page: 3,
        limit: 10,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('returns pagination metadata and keeps the user-scoped response without a user relation', async () => {
      const reservations = [buildReservation(), buildReservation({ id: 'r2' })];
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([
        reservations,
        2,
      ]);

      const result = await service.findAllByUser({
        userId: 'user-1',
        page: 1,
        limit: 10,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: { room: { building: true } },
        order: { startAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        data: reservations,
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });
  });

  describe('findAllByRoom', () => {
    it('maps each reservation user through toSafeUser', async () => {
      const reservations = [
        buildReservation({ user: buildUser({ password: 'secret-1' }) }),
        buildReservation({
          id: 'r2',
          user: buildUser({ id: 'user-2', password: 'secret-2' }),
        }),
      ];
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([
        reservations,
        2,
      ]);

      const result = await service.findAllByRoom({
        roomId: 'room-1',
        page: 1,
        limit: 10,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        relations: {
          room: { building: true },
          user: true,
        },
        order: { startAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      result.data.forEach((reservation) => {
        expect(reservation.user).not.toHaveProperty('password');
      });
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('defaults sortOrder to DESC and normalizes pagination the same way as findAllByUser', async () => {
      (reservationRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.findAllByRoom({
        roomId: 'room-1',
        page: 0,
        limit: 500,
      });

      expect(reservationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { startAt: 'DESC' },
          skip: 0,
          take: 100,
        }),
      );
    });
  });

  describe('getOperatingHours', () => {
    it('falls back to the default operating hours when config has no override', () => {
      const result = service.getOperatingHours();

      expect(config.get).toHaveBeenCalledWith('OPERATING_START', '09:00');
      expect(config.get).toHaveBeenCalledWith('OPERATING_END', '18:00');
      expect(result).toEqual({ start: '09:00', end: '18:00' });
    });

    it('uses the values provided by ConfigService when set', () => {
      (config.get as jest.Mock).mockImplementation(
        (key: string, def?: unknown) => {
          if (key === 'OPERATING_START') return '08:00';
          if (key === 'OPERATING_END') return '20:00';
          return def;
        },
      );

      const result = service.getOperatingHours();

      expect(result).toEqual({ start: '08:00', end: '20:00' });
    });
  });

  describe('getReservationGroupedByDay', () => {
    it('throws NotFoundException when the room does not exist', async () => {
      (roomRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getReservationGroupedByDay('room-1', 'America/Mexico_City'),
      ).rejects.toThrow(new NotFoundException('Sala no encontrada'));
      expect(reservationRepo.query).not.toHaveBeenCalled();
    });

    it('returns the rows produced by the grouped query', async () => {
      const room = buildRoom();
      (roomRepo.findOne as jest.Mock).mockResolvedValue(room);
      const rows = [{ day: '2026-06-14', reservations: [] }];
      (reservationRepo.query as jest.Mock).mockResolvedValue(rows);

      const result = await service.getReservationGroupedByDay(
        room.id,
        'America/Mexico_City',
      );

      expect(reservationRepo.query).toHaveBeenCalledTimes(1);
      expect(result).toBe(rows);
    });
  });
});
