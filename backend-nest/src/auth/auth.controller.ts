import { Controller, Post, Body, Req, Res, Get, Query, HttpCode, HttpStatus, UsePipes, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod/dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(20, "Password cannot exceed 20 characters")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
  .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
  .regex(/[0-9]/, "Password must contain at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

export class SignupDto extends createZodDto(z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  jobRole: z.string().optional(),
})) {}

export class LoginDto extends createZodDto(z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})) {}

export class MagicLinkReqDto extends createZodDto(z.object({
  email: z.string().email("Invalid email address"),
})) {}

export class VerifyMagicLinkDto extends createZodDto(z.object({
  token: z.string().min(1, "Token is required"),
})) {}

export class GoogleAuthDto extends createZodDto(z.object({
  idToken: z.string().min(1, "idToken is required"),
})) {}

export class GithubExchangeDto extends createZodDto(z.object({
  code: z.string().min(1, "code is required"),
})) {}

const isProduction = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const LOGGED_IN_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto.email, dto.password, dto.name, dto.jobRole);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto.email, dto.password);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    return { user, accessToken };
  }

  @Post('magic-link')
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(@Body() dto: MagicLinkReqDto) {
    return this.authService.sendMagicLink(dto.email);
  }

  @Post('verify-magic-link')
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(@Body() dto: VerifyMagicLinkDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.verifyMagicLink(dto.token);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    return { user, accessToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request) {
    const userId = req.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const user = await this.authService.getMe(userId);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      res.clearCookie("cadence_logged_in", { path: "/" });
      res.status(401).json({ error: "Refresh token missing" });
      return;
    }

    try {
      const { user, accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(refreshToken);
      res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
      res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
      return { user, accessToken };
    } catch (err) {
      res.clearCookie("refreshToken", { path: "/api/auth" });
      res.clearCookie("cadence_logged_in", { path: "/" });
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.clearCookie("cadence_logged_in", { path: "/" });
    return { message: "Logged out successfully" };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(@Body() dto: GoogleAuthDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.googleAuth(dto.idToken);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    return { user, accessToken };
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      res.status(400).json({ error: "Authorization code missing" });
      return;
    }

    try {
      const { oneTimeCode, refreshToken } = await this.authService.githubAuthCallback(code);
      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
      res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?code=${oneTimeCode}`);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  @Post('github/exchange')
  @HttpCode(HttpStatus.OK)
  async githubExchange(@Body() dto: GithubExchangeDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.exchangeGithubCode(dto.code);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    return { user, accessToken };
  }
}
