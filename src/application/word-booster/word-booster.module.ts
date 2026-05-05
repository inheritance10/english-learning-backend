import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UserWordSrsEntity } from '../../domain/entities/user-word-srs.entity';
import { StoryEntity } from '../../domain/entities/story.entity';
import { WordEntity } from '../../domain/entities/word.entity';
import { UserSeenWordEntity } from '../../domain/entities/user-seen-word.entity';
import { WordTranslationEntity } from '../../domain/entities/word-translation.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { VocabularyItemEntity } from '../../domain/entities/vocabulary-item.entity';
import { SrsService } from './srs.service';
import { WordBoosterSessionService } from './word-booster-session.service';
import { WordBoosterController } from './word-booster.controller';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { WORD_BOOSTER_QUEUE } from '../notifications/word-booster.producer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserWordSrsEntity,
      StoryEntity,
      WordEntity,
      UserSeenWordEntity,
      WordTranslationEntity,
      UserEntity,
      VocabularyItemEntity,
    ]),
    BullModule.registerQueue({ name: WORD_BOOSTER_QUEUE }),
    AuthModule,
  ],
  controllers: [WordBoosterController],
  providers: [SrsService, WordBoosterSessionService, GeminiService],
  exports: [SrsService],
})
export class WordBoosterModule {}
