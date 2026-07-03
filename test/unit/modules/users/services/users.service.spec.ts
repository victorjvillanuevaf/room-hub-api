jest.mock('bcryptjs');

import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from 'src/modules/users/services/users.service';
import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { GetUserDto } from 'src/modules/users/dto/get-user.dto';

describe('UsersService', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'user@example.com',
    password: 'hashed-password',
    name: 'John Doe',
    role: UserRole.USER,
    reservations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildRepo = () =>
    ({
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    }) as unknown as Repository<User>;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('throws ConflictException when a user with the email already exists', async () => {
      const repo = buildRepo();
      (repo.findOne as jest.Mock).mockResolvedValue(buildUser());
      const service = new UsersService(repo);

      await expect(
        service.create({
          email: 'user@example.com',
          password: 'plain-password',
          name: 'John Doe',
          role: UserRole.USER,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('hashes the password and creates the user when the email is not taken', async () => {
      const repo = buildRepo();
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      const createdEntity = buildUser({ password: 'hashed-password' });
      (repo.create as jest.Mock).mockReturnValue(createdEntity);
      (repo.save as jest.Mock).mockResolvedValue(createdEntity);
      const hashMock = bcrypt.hash as jest.Mock;
      hashMock.mockResolvedValue('hashed-password');
      const service = new UsersService(repo);

      const result = await service.create({
        email: 'user@example.com',
        password: 'plain-password',
        name: 'John Doe',
        role: UserRole.USER,
      });

      expect(hashMock).toHaveBeenCalledWith('plain-password', 10);
      expect(repo.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'hashed-password',
        name: 'John Doe',
        role: UserRole.USER,
      });
      expect(repo.save).toHaveBeenCalledWith(createdEntity);
      expect(result).toBe(createdEntity);
    });
  });

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      const repo = buildRepo();
      const user = buildUser();
      (repo.findOne as jest.Mock).mockResolvedValue(user);
      const service = new UsersService(repo);

      const result = await service.findByEmail('user@example.com');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(result).toBe(user);
    });

    it('returns null when the user is not found', async () => {
      const repo = buildRepo();
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      const service = new UsersService(repo);

      const result = await service.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const repo = buildRepo();
      const user = buildUser();
      (repo.findOne as jest.Mock).mockResolvedValue(user);
      const service = new UsersService(repo);

      const result = await service.findById('user-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toBe(user);
    });

    it('returns null when the user is not found', async () => {
      const repo = buildRepo();
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      const service = new UsersService(repo);

      const result = await service.findById('missing-id');

      expect(result).toBeNull();
    });
  });

  describe('findAllPaginated', () => {
    const baseDto: GetUserDto = {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    };

    it('maps users through toSafeUser and returns pagination metadata', async () => {
      const repo = buildRepo();
      const users = [buildUser({ id: 'user-1' }), buildUser({ id: 'user-2' })];
      (repo.findAndCount as jest.Mock).mockResolvedValue([users, 2]);
      const service = new UsersService(repo);

      const result = await service.findAllPaginated(baseDto);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result.data).toHaveLength(2);
      result.data.forEach((user) => {
        expect(user).not.toHaveProperty('password');
      });
      expect(result).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('normalizes page to at least 1 when page is 0', async () => {
      const repo = buildRepo();
      (repo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
      const service = new UsersService(repo);

      const result = await service.findAllPaginated({
        ...baseDto,
        page: 0,
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
      expect(result.page).toBe(1);
    });

    it('clamps limit to a minimum of 1 when limit is 0', async () => {
      const repo = buildRepo();
      (repo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
      const service = new UsersService(repo);

      const result = await service.findAllPaginated({
        ...baseDto,
        limit: 0,
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
      expect(result.limit).toBe(1);
    });

    it('clamps limit to a maximum of 100 when limit is 500', async () => {
      const repo = buildRepo();
      (repo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
      const service = new UsersService(repo);

      const result = await service.findAllPaginated({
        ...baseDto,
        limit: 500,
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
      expect(result.limit).toBe(100);
    });

    it('computes totalPages using the normalized limit', async () => {
      const repo = buildRepo();
      (repo.findAndCount as jest.Mock).mockResolvedValue([[], 25]);
      const service = new UsersService(repo);

      const result = await service.findAllPaginated({
        ...baseDto,
        limit: 10,
      });

      expect(result.totalPages).toBe(3);
    });

    it('calculates skip based on normalized page and limit', async () => {
      const repo = buildRepo();
      (repo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
      const service = new UsersService(repo);

      await service.findAllPaginated({ ...baseDto, page: 3, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('orders by the requested sortBy and sortOrder', async () => {
      const repo = buildRepo();
      (repo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
      const service = new UsersService(repo);

      await service.findAllPaginated({
        ...baseDto,
        sortBy: 'email',
        sortOrder: 'ASC',
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { email: 'ASC' } }),
      );
    });
  });
});
