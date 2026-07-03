import { ReservationsGateway } from 'src/modules/reservations/gateway/reservation.gateway';

describe('ReservationsGateway', () => {
  let gateway: ReservationsGateway;

  beforeEach(() => {
    gateway = new ReservationsGateway();
  });

  it('joins the socket to the room channel', async () => {
    const client = { join: jest.fn(), leave: jest.fn() };

    await gateway.handleJoinRoom('room-1', client as any);

    expect(client.join).toHaveBeenCalledWith('room_room-1');
  });

  it('removes the socket from the room channel', async () => {
    const client = { join: jest.fn(), leave: jest.fn() };

    await gateway.handleLeaveRoom('room-1', client as any);

    expect(client.leave).toHaveBeenCalledWith('room_room-1');
  });

  it('emits a reservationUpdate event to the room channel', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as any;

    const payload = { type: 'created', reservation: { id: 'r1' } };
    gateway.emitReservationUpdate('room-1', payload);

    expect(to).toHaveBeenCalledWith('room_room-1');
    expect(emit).toHaveBeenCalledWith('reservationUpdate', payload);
  });
});
