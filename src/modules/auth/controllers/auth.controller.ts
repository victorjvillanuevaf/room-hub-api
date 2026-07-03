import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from 'src/modules/users/enum/user.enum';
import type { Request, Response } from 'express';
import { RevokeAllSessionsDto } from '../dto/revoke-all.dto';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...response } = await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...response } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Post('v1/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  async refresh(@Req() req: Request) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    return this.authService.refresh(refreshToken);
  }

  @Post('v1/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout by revoking the provided refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string;
    console.log('Revoking refresh token:', refreshToken);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth/v1' });
    return { message: 'Logged out' };
  }

  @Post('revoke-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Revoke all sessions for the authenticated user' })
  revokeAllSessions(@Body() dto: RevokeAllSessionsDto) {
    return this.authService.revokeAllSessions(dto.userId);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/v1',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}
