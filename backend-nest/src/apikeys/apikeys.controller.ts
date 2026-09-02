import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, UsePipes } from '@nestjs/common';
import { ApikeysService } from './apikeys.service';
import { CreateApiKeyDto } from './dto/create-apikey.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'nestjs-zod';
import { Request } from 'express';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApikeysController {
  constructor(private readonly apikeysService: ApikeysService) {}

  @Post()
  @UsePipes(ZodValidationPipe)
  createKey(@Req() req: Request, @Body() createApiKeyDto: CreateApiKeyDto) {
    return this.apikeysService.createKey(req.userId as string, createApiKeyDto.name);
  }

  @Get()
  listKeys(@Req() req: Request) {
    return this.apikeysService.listKeys(req.userId as string);
  }

  @Delete(':id')
  revokeKey(@Req() req: Request, @Param('id') id: string) {
    return this.apikeysService.revokeKey(req.userId as string, id);
  }
}
