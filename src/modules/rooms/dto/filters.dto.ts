import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID } from 'class-validator';
import { PaginatedParamsDto } from 'src/common/dto/paginated-params.dto';

export class FindAllRoomsDto extends PaginatedParamsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  capacity?: number;
}
