import { Module } from '@nestjs/common';
import { ApikeysController } from './apikeys.controller';
import { ApikeysService } from './apikeys.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApikeysController],
  providers: [ApikeysService],
})
export class ApikeysModule {}
