import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './entities/building.entity';
import { BuildingsController } from './controllers/buildings.controller';
import { BuildingsService } from './services/buildings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Building])],
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [TypeOrmModule],
})
export class BuildingsModule {}
