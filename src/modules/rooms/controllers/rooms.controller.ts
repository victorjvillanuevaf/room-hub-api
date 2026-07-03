import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/enum/user.enum';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { Room } from '../entities/room.entity';
import { RoomsService } from '../services/rooms.service';
import { RoomAvailabilityDetails } from '../types/room-details.type';
import { FindAllRoomsDto } from '../dto/filters.dto';
import { PaginatedResponse } from 'src/common/types/paginated-response';
import { sleep } from 'src/common/utils/sleep';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms with building data' })
  @UseGuards(JwtAuthGuard)
  list(@Query() filters: FindAllRoomsDto): Promise<PaginatedResponse<Room>> {
    return this.roomsService.list(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by id with building data' })
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string): Promise<Room> {
    return this.roomsService.findById(id);
  }

  @Get(':id/details')
  @ApiOperation({
    summary: 'Get a room by id with building and reservations data',
  })
  @UseGuards(JwtAuthGuard)
  getRoomDetails(
    @Param('id', new ParseUUIDPipe()) id: string,
    // @Param('id') id: string,
    @Headers('x-timezone') timezone: string = 'UTC',
  ): Promise<RoomAvailabilityDetails> {
    return this.roomsService.getRoomAvailabilityDetails(id, timezone);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a room (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.roomsService.update(id, dto);
  }

  @Get('building/:buildingId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get rooms by building id' })
  findByBuildingId(@Param('buildingId') buildingId: string): Promise<Room[]> {
    return this.roomsService.findByBuildingId(buildingId);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload room image (admin only)',
    description: 'Upload a PNG, JPEG or JPG image (max 5MB)',
  })
  async uploadImage(
    @Param('id') roomId: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ): Promise<Room> {
    await sleep(2000);
    // throw new Error('Simulated error for testing purposes');
    return this.roomsService.uploadImage(roomId, file);
  }
}
