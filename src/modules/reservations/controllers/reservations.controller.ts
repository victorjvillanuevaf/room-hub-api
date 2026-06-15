import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ReservationsService } from '../services/reservations.service';

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
  findAll(@Req() request: AuthenticatedRequest) {
    return this.reservationsService.findAllByUser(request.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a reservation for the authenticated user' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(request.user, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a reservation by id' })
  async delete(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.reservationsService.delete(id, request.user);
  }
}
