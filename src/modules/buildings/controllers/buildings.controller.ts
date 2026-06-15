import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { BuildingsService } from '../services/buildings.service';

@ApiTags('buildings')
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all buildings' })
  @ApiResponse({
    status: 200,
    description: 'List of buildings retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  list() {
    return this.buildingsService.list();
  }
}
