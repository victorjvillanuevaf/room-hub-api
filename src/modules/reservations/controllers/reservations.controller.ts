import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ReservationsService } from '../services/reservations.service';
import {
  FindReservationByRoomDto,
  FindReservationByUserDto,
} from '../dto/find-reservation.dto';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { sleep } from 'src/common/utils/sleep';

type AuthenticatedRequest = Request & {
  user: User;
};

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List reservations of the authenticated user' })
  findAllByUser(
    @Req() request: AuthenticatedRequest,
    @Query() query: FindReservationByUserDto,
  ) {
    return this.reservationsService.findAllByUser({
      userId:
        request.user.role === UserRole.ADMIN
          ? (query.userId ?? request.user.id)
          : request.user.id,
      page: query.page,
      limit: query.limit,
      sortOrder: query.sortOrder,
    });
  }

  @Get('room')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List reservations of a specific room' })
  findAllByRoom(@Query() query: FindReservationByRoomDto) {
    return this.reservationsService.findAllByRoom({
      roomId: query.roomId,
      page: query.page,
      limit: query.limit,
      sortOrder: query.sortOrder,
    });
  }

  @Get('operating-hours')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the operating hours bounds for reservations' })
  getOperatingHours() {
    return this.reservationsService.getOperatingHours();
  }

  @Get('max-allowed-days-ahead')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get the maximum allowed days ahead for reservations',
  })
  getMaxAllowedDaysAhead() {
    return {
      maxAllowedDaysAhead:
        this.reservationsService.getMaxAllowedReservationDaysAhead(),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a reservation for the authenticated user' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReservationDto,
  ) {
    await sleep(2000);
    // throw new Error('Simulated error for testing purposes');
    return this.reservationsService.create(request.user, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a reservation by id' })
  async cancel(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    await sleep(2000);
    return this.reservationsService.cancel(id, request.user);
  }
}
