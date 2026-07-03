import { BuildingsController } from 'src/modules/buildings/controllers/buildings.controller';
import { BuildingsService } from 'src/modules/buildings/services/buildings.service';
import { Building } from 'src/modules/buildings/entities/building.entity';

describe('BuildingsController', () => {
  let controller: BuildingsController;
  let buildingsService: Partial<Record<keyof BuildingsService, jest.Mock>>;

  beforeEach(() => {
    buildingsService = {
      list: jest.fn(),
    };

    controller = new BuildingsController(
      buildingsService as unknown as BuildingsService,
    );
  });

  describe('list', () => {
    it('should delegate to the service and return its result', async () => {
      const buildings = [
        { id: '1', name: 'Building A', address: '123 Main St' },
        { id: '2', name: 'Building B', address: '456 Second St' },
      ] as Building[];
      buildingsService.list!.mockResolvedValue(buildings);

      const result = await controller.list();

      expect(result).toEqual(buildings);
      expect(buildingsService.list).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array when the service resolves with none', async () => {
      buildingsService.list!.mockResolvedValue([]);

      const result = await controller.list();

      expect(result).toEqual([]);
    });
  });
});
