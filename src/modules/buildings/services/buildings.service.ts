import { InjectRepository } from '@nestjs/typeorm';
import { Building } from '../entities/building.entity';
import { Repository } from 'typeorm';

export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
  ) {}

  list() {
    return this.buildingRepo.find();
  }
}
