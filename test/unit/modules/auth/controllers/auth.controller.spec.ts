import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from 'src/modules/auth/controllers/auth.controller';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { RegisterDto } from 'src/modules/auth/dto/register.dto';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { RevokeAllSessionsDto } from 'src/modules/auth/dto/revoke-all.dto';

describe('AuthController', () => {
  let authService: jest.Mocked<AuthService>;
  let controller: AuthController;
  let res: Response;

  const buildRes = (): Response =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as unknown as Response;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      revokeAllSessions: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    controller = new AuthController(authService);
    res = buildRes();
  });

  describe('register', () => {
    it('sets the refresh cookie and returns the response without the refresh token', async () => {
      const dto: RegisterDto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      };
      authService.register.mockResolvedValue({
        user: {
          id: 'user-1',
          name: 'New User',
          email: dto.email,
          role: 'user',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.register(dto, res);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/auth/v1',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
      expect(result).toEqual({
        user: {
          id: 'user-1',
          name: 'New User',
          email: dto.email,
          role: 'user',
        },
        accessToken: 'access-token',
      });
      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('login', () => {
    it('sets the refresh cookie and returns the response without the refresh token', async () => {
      const dto: LoginDto = {
        email: 'user@example.com',
        password: 'password123',
      };
      authService.login.mockResolvedValue({
        user: { id: 'user-1', name: 'John', email: dto.email, role: 'user' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.login(dto, res);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/auth/v1',
        }),
      );
      expect(result).toEqual({
        user: { id: 'user-1', name: 'John', email: dto.email, role: 'user' },
        accessToken: 'access-token',
      });
      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('refresh', () => {
    it('delegates to authService.refresh when a refresh token cookie is present', async () => {
      const req = {
        cookies: { refreshToken: 'valid-token' },
      } as unknown as Request;
      const expected = {
        user: {
          id: 'user-1',
          name: 'John',
          email: 'user@example.com',
          role: 'user',
        },
        accessToken: 'new-access-token',
      };
      authService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh(req);

      expect(authService.refresh).toHaveBeenCalledWith('valid-token');
      expect(result).toBe(expected);
    });

    it('throws UnauthorizedException when there is no refresh token cookie', async () => {
      const req = { cookies: {} } as unknown as Request;

      await expect(controller.refresh(req)).rejects.toThrow(
        new UnauthorizedException('No refresh token provided'),
      );
      expect(authService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('logs out and clears the cookie when a refresh token cookie is present', async () => {
      const req = {
        cookies: { refreshToken: 'valid-token' },
      } as unknown as Request;
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('valid-token');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/auth/v1',
      });
      expect(result).toEqual({ message: 'Logged out' });
    });

    it('clears the cookie without calling authService.logout when there is no refresh token cookie', async () => {
      const req = { cookies: {} } as unknown as Request;

      const result = await controller.logout(req, res);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/auth/v1',
      });
      expect(result).toEqual({ message: 'Logged out' });
    });
  });

  describe('revokeAllSessions', () => {
    it('delegates to authService.revokeAllSessions and returns its result', async () => {
      const dto: RevokeAllSessionsDto = { userId: 'user-1' };
      authService.revokeAllSessions.mockResolvedValue(undefined);

      const result = await controller.revokeAllSessions(dto);

      expect(authService.revokeAllSessions).toHaveBeenCalledWith(dto.userId);
      expect(result).toBeUndefined();
    });
  });
});
