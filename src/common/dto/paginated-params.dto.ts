import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type SortOrder = 'ASC' | 'DESC';

export abstract class PaginatedParamsDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: SortOrder;
}
