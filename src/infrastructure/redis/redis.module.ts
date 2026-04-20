import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const client = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
          retryStrategy: (times) => Math.min(times * 200, 3000),
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
