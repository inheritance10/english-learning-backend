import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { TopicsController } from '../../presentation/controllers/topics.controller';
import { GetTopicsUseCase } from './use-cases/get-topics.use-case';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([TopicEntity]), AuthModule],
  controllers: [TopicsController],
  providers: [GetTopicsUseCase],
  exports: [GetTopicsUseCase],
})
export class TopicsModule {}
