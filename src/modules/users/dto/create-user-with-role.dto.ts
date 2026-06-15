import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enum/user.enum';

export class CreateUserWithRoleDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'Jane Admin' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'admin', enum: ['user', 'admin'] })
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: UserRole;
}
