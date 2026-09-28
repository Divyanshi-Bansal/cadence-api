import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;
  private hasLoggedOfflineWarning = false;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          if (!this.hasLoggedOfflineWarning) {
            this.logger.warn(`[Redis] Unreachable at ${redisUrl}. Operating in fallback mode.`);
            this.hasLoggedOfflineWarning = true;
          }
          return null; // Stop reconnecting after 3 failed attempts
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.redisClient.on('connect', () => {
      this.isConnected = true;
      this.hasLoggedOfflineWarning = false;
      this.logger.log('Connected to Redis successfully');
    });

    this.redisClient.on('error', (err) => {
      this.isConnected = false;
      if (!this.hasLoggedOfflineWarning) {
        this.logger.warn(`Redis connection unavailable (${err.message || 'ECONNREFUSED'}). Operating in fallback mode.`);
        this.hasLoggedOfflineWarning = true;
      }
    });

    this.redisClient.on('end', () => {
      this.isConnected = false;
    });

    // Attempt initial connection without blocking NestJS server startup
    this.redisClient.connect().catch(() => {
      // Connection failure is caught via error event handlers
    });
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  /**
   * Set a key-value pair in Redis with an optional TTL (in seconds)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.redisClient || !this.isConnected) return;
    try {
      if (ttlSeconds) {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error) {
      this.logger.warn(`Redis SET failed for key "${key}": ${(error as Error).message}`);
    }
  }

  /**
   * Get a value from Redis by key
   */
  async get(key: string): Promise<string | null> {
    if (!this.redisClient || !this.isConnected) return null;
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.warn(`Redis GET failed for key "${key}": ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    if (!this.redisClient || !this.isConnected) return;
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.warn(`Redis DEL failed for key "${key}": ${(error as Error).message}`);
    }
  }
}
