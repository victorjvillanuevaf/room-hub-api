import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: 'Sala 10' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 25, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    example: '/uploads/room_images/a1b2c3.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string | null;
}
