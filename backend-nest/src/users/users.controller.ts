import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UsePipes,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ZodValidationPipe } from 'nestjs-zod';
import { createZodDto } from 'nestjs-zod/dto';
import {
  forgotPasswordSchema,
  updateUserSchema,
} from '../validations/userValidation';
import { Request } from 'express';

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class UpdateProfileDto extends createZodDto(updateUserSchema) {}

interface AuthenticatedRequest extends Request {
  userId: string;
}

@Controller('users')
@UsePipes(ZodValidationPipe)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.getProfile(req.userId);
    return { user };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.usersService.forgotPassword(dto.email);
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(req.userId, dto);
    return { user };
  }
}
