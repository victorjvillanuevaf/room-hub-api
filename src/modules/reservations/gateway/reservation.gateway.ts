import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class ReservationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(`room_${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    await client.leave(`room_${roomId}`);
  }

  emitReservationUpdate(roomId: string, payload: unknown) {
    this.server.to(`room_${roomId}`).emit('reservationUpdate', payload);
  }
}
