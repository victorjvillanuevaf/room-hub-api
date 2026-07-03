export type ReservationStatus = 'UPCOMING' | 'IN_PROGRESS' | 'PAST';

export type Reservation = {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
};

export type ReservationGroupedByDay = {
  day: string;
  availability: boolean;
  reservations: Reservation[];
};

export type RoomAvailabilityDetails = {
  id: string;
  reservationsGroupedByDay: ReservationGroupedByDay[];
};
