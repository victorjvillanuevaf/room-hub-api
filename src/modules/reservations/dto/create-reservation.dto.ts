import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({
    example: '8f1d3d43-5ce4-43c8-86e4-99fb6a2ea4fb',
    description: 'Room identifier',
  })
  @IsUUID()
  roomId!: string;

  @ApiProperty({
    example: '9c2b1a5e-7d4f-4e8b-9f1a-2c3d4e5f6a7b',
    description: 'User identifier (optional, will be set from auth context)',
  })
  @IsUUID()
  userId?: string; // Optional, will be set from the authenticated user context

  @ApiProperty({
    example: '2026-06-14T14:00:00.000Z',
    description: 'Reservation start time in ISO-8601 format',
  })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    example: '2026-06-14T15:00:00.000Z',
    description: 'Reservation end time in ISO-8601 format',
  })
  @IsDateString()
  endAt!: string;
}
