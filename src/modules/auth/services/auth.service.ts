import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../../users/services/users.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UserRole } from 'src/modules/users/enum/user.enum';
import { User } from 'src/modules/users/entities/user.entity';
import { randomUUID } from 'crypto';
import { RefreshTokenService } from 'src/modules/redis/services/refresk-token.service';
import {
  LoginResponse,
  RefreshResponse,
  RegisterResponse,
} from '../types/auth-response.types';

// const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  jwtRefreshSecret: string;
  jwtExpiresIn: `${number}${'s' | 'm' | 'h' | 'd'}`;

  constructor(
    private readonly logger: Logger,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    this.jwtRefreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
    ) as string;
    this.jwtExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
  }

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const user = await this.usersService.create({
      ...dto,
      role: UserRole.USER,
    });
    return this.buildResponse(user) as unknown as RegisterResponse;
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildResponse(user) as unknown as LoginResponse;
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const isValid = await this.refreshTokenService.exists(payload.jti);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token revocado');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return this.buildResponse(user, false);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        { secret: this.jwtRefreshSecret },
      );
      await this.refreshTokenService.revoke(payload.jti, payload.sub);
    } catch {
      this.logger.warn('Invalid refresh token provided for logout');
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  private makeAccessToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async makeRefreshToken(user: User): Promise<string> {
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        jti,
      },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtExpiresIn,
      },
    );

    await this.refreshTokenService.store(jti, user.id);

    return refreshToken;
  }

  private async buildResponse(user: User, withRefreshToken = true) {
    const accessToken = this.makeAccessToken(user);
    const refreshToken = withRefreshToken
      ? await this.makeRefreshToken(user)
      : undefined;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      ...(withRefreshToken && { refreshToken }),
    };
  }
}
