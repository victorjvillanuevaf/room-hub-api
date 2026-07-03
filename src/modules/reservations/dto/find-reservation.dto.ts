import { IsOptional, IsUUID } from 'class-validator';
import { PaginatedParamsDto } from 'src/common/dto/paginated-params.dto';

export class FindReservationByRoomDto extends PaginatedParamsDto {
  @IsUUID()
  @IsOptional()
  roomId?: string;
}

export class FindReservationByUserDto extends PaginatedParamsDto {
  @IsUUID()
  @IsOptional()
  userId?: string;
}

export type FindReservationQueryDto<TIdentifier extends 'roomId' | 'userId'> =
  PaginatedParamsDto & Record<TIdentifier, string>;
