import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyItemEntity } from '../../domain/entities/vocabulary-item.entity';
import { VocabularyController } from '../../presentation/controllers/vocabulary.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([VocabularyItemEntity]), AuthModule],
  controllers: [VocabularyController],
})
export class VocabularyModule {}
