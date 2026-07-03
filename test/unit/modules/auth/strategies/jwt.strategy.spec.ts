import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { UsersService } from 'src/modules/users/services/users.service';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { User } from 'src/modules/users/entities/user.entity';

describe('JwtStrategy', () => {
  const config = {
    get: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;

  it('returns the user when it exists', async () => {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      password: 'hash',
      name: 'John',
      role: UserRole.USER,
      reservations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(user),
    } as unknown as UsersService;
    const strategy = new JwtStrategy(config, usersService);

    const result = await strategy.validate({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    expect(result).toBe(user);
    expect(usersService.findById).toHaveBeenCalledWith(user.id);
  });

  it('throws UnauthorizedException when the user is not found', async () => {
    const usersService = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as UsersService;
    const strategy = new JwtStrategy(config, usersService);

    await expect(
      strategy.validate({
        sub: 'missing-user',
        email: 'missing@example.com',
        role: UserRole.USER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
