import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enum/reservation-status.enum';
import { UserRole } from 'src/modules/users/enum/user.enum';

type SafeUser = Omit<User, 'password'>;

type ReservationResponse = Omit<Reservation, 'user'> & {
  room: Room & { building: Room['building'] };
  user: SafeUser;
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
  ) {}

  async create(
    user: User,
    dto: CreateReservationDto,
  ): Promise<ReservationResponse> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid reservation date range');
    }

    if (startAt >= endAt) {
      throw new BadRequestException('startAt must be earlier than endAt');
    }

    const room = await this.roomRepo.findOne({
      where: { id: dto.roomId },
      relations: { building: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const reservation = this.reservationRepo.create({
      roomId: room.id,
      userId: user.id,
      startAt,
      endAt,
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

      const { password, ...safeUser } = createdReservation.user;
      void password;

      return {
        ...createdReservation,
        user: safeUser,
      };
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

  async delete(id: string, user: User): Promise<void> {
    const reservation = await this.reservationRepo.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.user.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'You can only delete your own reservations',
      );
    }

    await this.reservationRepo.update(
      { id },
      { status: ReservationStatus.CANCELLED },
    );
  }

  async findAllByUser(userId: string): Promise<ReservationResponse[]> {
    const reservations = await this.reservationRepo.find({
      where: { userId },
      relations: {
        room: { building: true },
        user: true,
      },
    });

    return reservations.map((reservation) => {
      const { password, ...safeUser } = reservation.user;
      void password;

      return {
        ...reservation,
        user: safeUser,
      };
    });
  }
}
