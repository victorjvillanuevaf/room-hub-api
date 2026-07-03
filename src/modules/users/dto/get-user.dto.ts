import { IsInt, IsOptional, Min } from 'class-validator';
import { User } from '../entities/user.entity';
import { Type } from 'class-transformer';

export class GetUserDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  sortBy: keyof User = 'createdAt';

  @IsOptional()
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}
