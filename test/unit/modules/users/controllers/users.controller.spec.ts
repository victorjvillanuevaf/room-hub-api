import { NotFoundException } from '@nestjs/common';
import { UsersController } from 'src/modules/users/controllers/users.controller';
import { UsersService } from 'src/modules/users/services/users.service';
import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { GetUserDto } from 'src/modules/users/dto/get-user.dto';
import { CreateUserWithRoleDto } from 'src/modules/users/dto/create-user-with-role.dto';

describe('UsersController', () => {
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

  const buildUsersService = () =>
    ({
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAllPaginated: jest.fn(),
      create: jest.fn(),
    }) as unknown as UsersService;

  describe('findById', () => {
    it('returns the safe user when found', async () => {
      const usersService = buildUsersService();
      const user = buildUser();
      (usersService.findById as jest.Mock).mockResolvedValue(user);
      const controller = new UsersController(usersService);

      const result = await controller.findById('user-1');

      expect(usersService.findById).toHaveBeenCalledWith('user-1');
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ id: 'user-1', email: 'user@example.com' });
    });

    it('throws NotFoundException when the user is not found', async () => {
      const usersService = buildUsersService();
      (usersService.findById as jest.Mock).mockResolvedValue(null);
      const controller = new UsersController(usersService);

      await expect(controller.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('returns the safe user when found', async () => {
      const usersService = buildUsersService();
      const user = buildUser();
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
      const controller = new UsersController(usersService);

      const result = await controller.findByEmail('user@example.com');

      expect(usersService.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ email: 'user@example.com' });
    });

    it('throws NotFoundException when the user is not found', async () => {
      const usersService = buildUsersService();
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      const controller = new UsersController(usersService);

      await expect(
        controller.findByEmail('missing@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllPaginated', () => {
    it('delegates to usersService.findAllPaginated and returns its result as-is', async () => {
      const usersService = buildUsersService();
      const dto: GetUserDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      const paginatedResult = {
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      };
      (usersService.findAllPaginated as jest.Mock).mockResolvedValue(
        paginatedResult,
      );
      const controller = new UsersController(usersService);

      const result = await controller.findAllPaginated(dto);

      expect(usersService.findAllPaginated).toHaveBeenCalledWith(dto);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('createAnyUser', () => {
    it('creates the user and returns the safe user', async () => {
      const usersService = buildUsersService();
      const dto: CreateUserWithRoleDto = {
        email: 'new-user@example.com',
        password: 'plain-password',
        name: 'New User',
        role: UserRole.ADMIN,
      };
      const createdUser = buildUser({
        email: 'new-user@example.com',
        name: 'New User',
        role: UserRole.ADMIN,
      });
      (usersService.create as jest.Mock).mockResolvedValue(createdUser);
      const controller = new UsersController(usersService);

      const result = await controller.createAnyUser(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({
        email: 'new-user@example.com',
        name: 'New User',
        role: UserRole.ADMIN,
      });
    });
  });
});
