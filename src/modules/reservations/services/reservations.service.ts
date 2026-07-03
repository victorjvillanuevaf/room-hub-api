import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { QueryFailedError, Repository } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { toSafeUser } from '../../users/utils/safe-user';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enum/reservation-status.enum';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { PaginatedResponse } from 'src/common/types/paginated-response';
import {
  FindReservationByRoomDto,
  FindReservationByUserDto,
} from '../dto/find-reservation.dto';
import { ReservationsGateway } from '../gateway/reservation.gateway';
import { ReservationGroupedByDay } from 'src/modules/rooms/types/room-details.type';
import { getLocalDayBoundsInUTC } from 'src/modules/rooms/utils/get-localdates-utc';
import { ConfigService } from '@nestjs/config';

type ReservationResponse = Omit<Reservation, 'user'> & {
  room: Room & { building: Room['building'] };
  user: Omit<User, 'password'>;
};

type PostgresDriverError = {
  code?: string;
};

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    private readonly reservationsGateway: ReservationsGateway,
    private readonly config: ConfigService,
  ) {}

  async create(
    user: User,
    dto: CreateReservationDto,
  ): Promise<ReservationResponse> {
    const startAt = DateTime.fromISO(dto.startAt, { setZone: true });
    const endAt = DateTime.fromISO(dto.endAt, { setZone: true });

    if (!startAt.isValid || !endAt.isValid) {
      throw new BadRequestException('Invalid reservation date range');
    }

    if (startAt.toMillis() >= endAt.toMillis()) {
      throw new BadRequestException('startAt must be earlier than endAt');
    }

    const room = await this.roomRepo.findOne({
      where: { id: dto.roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const reservation = this.reservationRepo.create({
      roomId: room.id,
      userId: user.role === UserRole.ADMIN ? (dto.userId ?? user.id) : user.id,
      startAt: startAt.toJSDate(),
      endAt: endAt.toJSDate(),
      status: ReservationStatus.ACTIVE,
    });

    try {
      const savedReservation = await this.reservationRepo.save(reservation);
      const createdReservation = await this.reservationRepo.findOne({
        where: { id: savedReservation.id },
        relations: {
          room: { building: true },
          user: true,
        },
      });

      if (!createdReservation) {
        throw new NotFoundException('Reservation not found after creation');
      }

      const saved = {
        ...createdReservation,
        user: toSafeUser(createdReservation.user),
      };

      this.reservationsGateway.emitReservationUpdate(saved.roomId, {
        type: 'created',
        reservation: saved,
      });

      return saved;
    } catch (error: unknown) {
      const queryError = error as QueryFailedError & {
        driverError?: PostgresDriverError;
      };

      if (
        error instanceof QueryFailedError &&
        queryError.driverError?.code === '23P01'
      ) {
        throw new ConflictException(
          'The room is already reserved for the selected time range',
        );
      }

      throw error;
    }
  }

  async cancel(id: string, user: User): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reservación no encontrada');
    }

    const cancellationWindowMinutes = this.config.get<number>(
      'CANCELLATION_WINDOW_MINUTES',
      60,
    );

    const now = DateTime.now();
    const startAt = DateTime.fromJSDate(reservation.startAt);

    const differenceInMinutes = startAt.diff(now, 'minutes').minutes;

    if (differenceInMinutes < cancellationWindowMinutes) {
      throw new BadRequestException(
        `No se puede cancelar una reservación que comienza dentro de ${cancellationWindowMinutes} minutos`,
      );
    }

    if (reservation.user.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Solo puedes eliminar tus propias reservaciones',
      );
    }

    reservation.status = ReservationStatus.CANCELLED;

    const updated = await this.reservationRepo.save(reservation);
    this.reservationsGateway.emitReservationUpdate(updated.roomId, {
      type: 'cancelled',
      reservation: updated,
    });

    return updated;
  }

  async findAllByUser({
    userId,
    page,
    limit,
    sortOrder = 'DESC',
  }: FindReservationByUserDto): Promise<
    PaginatedResponse<ReservationResponse>
  > {
    const normalizedPage = Math.max(page, 1);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);

    const [reservations, total] = await this.reservationRepo.findAndCount({
      where: { userId },
      relations: {
        room: {
          building: true,
        },
      },
      order: { startAt: sortOrder },
      take: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
    });

    return {
      data: reservations,
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  async findAllByRoom({
    roomId,
    page,
    limit,
    sortOrder = 'DESC',
  }: FindReservationByRoomDto): Promise<
    PaginatedResponse<ReservationResponse>
  > {
    const normalizedPage = Math.max(page, 1);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);

    const [reservations, total] = await this.reservationRepo.findAndCount({
      where: { roomId },
      relations: { user: true },
      order: { startAt: sortOrder },
      take: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
    });

    return {
      data: reservations.map((reservation) => ({
        ...reservation,
        user: toSafeUser(reservation.user),
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  getOperatingHours(): { start: string; end: string } {
    return {
      start: this.config.get<string>('OPERATING_START', '09:00'),
      end: this.config.get<string>('OPERATING_END', '18:00'),
    };
  }

  async getReservationGroupedByDay(
    id: string,
    timezone: string,
  ): Promise<ReservationGroupedByDay[]> {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Sala no encontrada');

    const { startUtc, endUtc } = getLocalDayBoundsInUTC(timezone);

    const rows = await this.reservationRepo.query<ReservationGroupedByDay[]>(
      `
      SELECT
        DATE(start_at AT TIME ZONE $4)::text AS day,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id',      id,
            'userId',  user_id,
            'startAt',  start_at AT TIME ZONE $4,
            'endAt',    end_at AT TIME ZONE $4,
            'startTime', TO_CHAR(start_at AT TIME ZONE $4, 'HH24:MI'),
            'endTime', TO_CHAR(end_at AT TIME ZONE $4, 'HH24:MI')
          ) ORDER BY start_at ASC
        ) AS reservations
      FROM reservations
      WHERE room_id = $1
        AND status = 'ACTIVE'
        AND start_at >= $2
        AND start_at <  $3
      GROUP BY DATE(start_at AT TIME ZONE $4)
      ORDER BY day ASC;
    `,
      [id, startUtc.toJSDate(), endUtc.toJSDate(), timezone],
    );

    return rows;
  }
}
