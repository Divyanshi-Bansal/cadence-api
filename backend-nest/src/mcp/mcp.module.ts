import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [McpController],
})
export class McpModule {}
