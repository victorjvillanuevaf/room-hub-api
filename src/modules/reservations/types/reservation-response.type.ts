import { User } from '../../users/entities/user.entity';
import { Reservation } from '../entities/reservation.entity';

export type ReservationByUserResponse = Omit<Reservation, 'user'>;

export type ReservationByRoomResponse = Omit<Reservation, 'user'> & {
  user: Omit<User, 'password'>;
};
