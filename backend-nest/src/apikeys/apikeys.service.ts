import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApikeysService {
  constructor(private readonly prisma: PrismaService) {}

  async createKey(userId: string, name: string) {
    const rawKey = `cadence_ak_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const token = await this.prisma.personalAccessToken.create({
      data: {
        userId,
        keyHash,
        name,
      },
    });

    return {
      id: token.id,
      name: token.name,
      key: rawKey,
      createdAt: token.createdAt,
    };
  }

  async listKeys(userId: string) {
    return this.prisma.personalAccessToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async revokeKey(userId: string, id: string) {
    const token = await this.prisma.personalAccessToken.findUnique({
      where: { id },
    });

    if (!token || token.userId !== userId) {
      throw new NotFoundException('Key not found');
    }

    await this.prisma.personalAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return { message: 'Key revoked successfully' };
  }
}
