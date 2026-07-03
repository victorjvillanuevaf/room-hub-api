import { BuildingsService } from 'src/modules/buildings/services/buildings.service';
import { Building } from 'src/modules/buildings/entities/building.entity';
import { Repository } from 'typeorm';

describe('BuildingsService', () => {
  let service: BuildingsService;
  let buildingRepo: Partial<Record<keyof Repository<Building>, jest.Mock>>;

  beforeEach(() => {
    buildingRepo = {
      find: jest.fn(),
    };

    service = new BuildingsService(
      buildingRepo as unknown as Repository<Building>,
    );
  });

  describe('list', () => {
    it('should return the buildings resolved by the repository', async () => {
      const buildings = [
        { id: '1', name: 'Building A', address: '123 Main St' },
        { id: '2', name: 'Building B', address: '456 Second St' },
      ] as Building[];
      buildingRepo.find!.mockResolvedValue(buildings);

      const result = await service.list();

      expect(result).toEqual(buildings);
    });

    it('should return an empty array when there are no buildings', async () => {
      buildingRepo.find!.mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });

    it('should call repository find with no arguments', async () => {
      buildingRepo.find!.mockResolvedValue([]);

      await service.list();

      expect(buildingRepo.find).toHaveBeenCalledWith();
      expect(buildingRepo.find).toHaveBeenCalledTimes(1);
    });
  });
});
