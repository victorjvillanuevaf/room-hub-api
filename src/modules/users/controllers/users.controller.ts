import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateUserWithRoleDto } from '../dto/create-user-with-role.dto';
import { UsersService } from '../services/users.service';
import { UserRole } from '../enum/user.enum';
import { toSafeUser } from '../utils/safe-user';
import { GetUserDto } from '../dto/get-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a user by id (admin only)' })
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toSafeUser(user);
  }

  @Get('by-email/:email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a user by email (admin only)' })
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toSafeUser(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users with pagination (admin only)' })
  async findAllPaginated(@Query() dto: GetUserDto) {
    return this.usersService.findAllPaginated(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a user with role (admin only)',
  })
  async createAnyUser(@Body() dto: CreateUserWithRoleDto) {
    const user = await this.usersService.create(dto);
    return toSafeUser(user);
  }
}
