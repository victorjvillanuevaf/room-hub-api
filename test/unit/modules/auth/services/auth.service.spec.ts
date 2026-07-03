jest.mock('bcryptjs');

import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { UsersService } from 'src/modules/users/services/users.service';
import { RefreshTokenService } from 'src/modules/redis/services/refresk-token.service';
import { RegisterDto } from 'src/modules/auth/dto/register.dto';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { User } from 'src/modules/users/entities/user.entity';

describe('AuthService', () => {
  const REFRESH_SECRET = 'refresh-secret';
  const REFRESH_EXPIRES_IN = '7d';

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

  let logger: Logger;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let service: AuthService;
  let compareMock: jest.Mock;

  beforeEach(() => {
    compareMock = bcrypt.compare as jest.Mock;
    compareMock.mockReset();

    logger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findAllPaginated: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
        if (key === 'JWT_REFRESH_EXPIRES_IN') return REFRESH_EXPIRES_IN;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    refreshTokenService = {
      store: jest.fn(),
      exists: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenService>;

    service = new AuthService(
      logger,
      usersService,
      jwtService,
      configService,
      refreshTokenService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('reads the refresh secret and expiration from ConfigService', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
      expect(configService.get).toHaveBeenCalledWith('JWT_REFRESH_EXPIRES_IN');
      expect(service.jwtRefreshSecret).toBe(REFRESH_SECRET);
      expect(service.jwtExpiresIn).toBe(REFRESH_EXPIRES_IN);
    });
  });

  describe('register', () => {
    it('creates a user with USER role and returns access + refresh tokens', async () => {
      const dto: RegisterDto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      };
      const createdUser = buildUser({
        id: 'user-2',
        email: dto.email,
        name: dto.name,
      });
      usersService.create.mockResolvedValue(createdUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      refreshTokenService.store.mockResolvedValue(undefined);

      const result = await service.register(dto);

      expect(usersService.create).toHaveBeenCalledWith({
        ...dto,
        role: UserRole.USER,
      });
      expect(result).toEqual({
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(refreshTokenService.store).toHaveBeenCalledWith(
        expect.any(String),
        createdUser.id,
      );
    });
  });

  describe('login', () => {
    it('returns access + refresh tokens when credentials are valid', async () => {
      const dto: LoginDto = {
        email: 'user@example.com',
        password: 'plain-password',
      };
      const user = buildUser({ email: dto.email });
      usersService.findByEmail.mockResolvedValue(user);
      compareMock.mockResolvedValue(true);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      refreshTokenService.store.mockResolvedValue(undefined);

      const result = await service.login(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, user.password);
      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      const dto: LoginDto = {
        email: 'missing@example.com',
        password: 'password',
      };
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      expect(compareMock).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      const dto: LoginDto = {
        email: 'user@example.com',
        password: 'wrong-password',
      };
      const user = buildUser({ email: dto.email });
      usersService.findByEmail.mockResolvedValue(user);
      compareMock.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  describe('refresh', () => {
    it('returns a new access token without a refresh token on success', async () => {
      const user = buildUser();
      jwtService.verify.mockReturnValue({ sub: user.id, jti: 'jti-1' });
      refreshTokenService.exists.mockResolvedValue(true);
      usersService.findById.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: REFRESH_SECRET,
      });
      expect(refreshTokenService.exists).toHaveBeenCalledWith('jti-1');
      expect(usersService.findById).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken: 'new-access-token',
      });
      expect(result).not.toHaveProperty('refreshToken');
      expect(refreshTokenService.store).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token fails verification', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token inválido o expirado'),
      );
      expect(refreshTokenService.exists).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the refresh token has been revoked', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1' });
      refreshTokenService.exists.mockResolvedValue(false);

      await expect(service.refresh('revoked-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token revocado'),
      );
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      jwtService.verify.mockReturnValue({ sub: 'missing-user', jti: 'jti-1' });
      refreshTokenService.exists.mockResolvedValue(true);
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-token')).rejects.toThrow(
        new UnauthorizedException('Usuario no encontrado'),
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token when it is valid', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti-1' });
      refreshTokenService.revoke.mockResolvedValue(undefined);

      await service.logout('valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: REFRESH_SECRET,
      });
      expect(refreshTokenService.revoke).toHaveBeenCalledWith(
        'jti-1',
        'user-1',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('swallows the error and logs a warning when the token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
      expect(refreshTokenService.revoke).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid refresh token provided for logout',
      );
    });
  });

  describe('revokeAllSessions', () => {
    it('delegates to refreshTokenService.revokeAllForUser', async () => {
      refreshTokenService.revokeAllForUser.mockResolvedValue(undefined);

      await service.revokeAllSessions('user-1');

      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });
});
