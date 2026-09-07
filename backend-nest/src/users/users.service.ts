import { Injectable, NotFoundException } from '@nestjs/common';
import { userRepository } from '../repositories/userRepository';
import { CleanUser } from '../lib/userFormat';

@Injectable()
export class UsersService {
  async getProfile(userId: string): Promise<CleanUser> {
    const user = await userRepository.findByUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    await userRepository.findByEmail(email);
    // No throw — returns void so controller sends a 200 response to prevent enumeration attacks.
  }

  async updateProfile(
    userId: string,
    data: { name?: string | null; jobRole?: string | null },
  ): Promise<CleanUser> {
    try {
      const user = await userRepository.update(userId, data);
      return user;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('User not found.');
      }
      throw err;
    }
  }
}
