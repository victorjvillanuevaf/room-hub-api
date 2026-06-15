import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/enum/user.enum';
import { Room } from '../entities/room.entity';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomsService } from '../services/rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms with building data' })
  @UseGuards(JwtAuthGuard)
  list(): Promise<Room[]> {
    return this.roomsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by id with building data' })
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string): Promise<Room> {
    return this.roomsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a room (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.roomsService.update(id, dto);
  }
}
