import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { UserEntity } from '../../../domain/entities/user.entity';
import { CEFRJ_ITEMS } from '../../../infrastructure/database/seeds/data/cefrj-items';

export interface LessonChatDto {
  topicId: string;
  topicName?: string; // fallback name if topicId not in DB
  messages: Array<{ role: 'user' | 'model'; content: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Keeps the system prompt short; the tutor covers these step by step. */
const MAX_SUBPOINTS = 12;

@Injectable()
export class LessonChatUseCase {
  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async execute(dto: LessonChatDto, user: UserEntity): Promise<{ reply: string }> {
    const topic = UUID_REGEX.test(dto.topicId)
      ? await this.topicRepo.findOne({ where: { id: dto.topicId } })
      : null;
    const learnerLevel = user.cefrLevel ?? 'B1';

    const subpoints = (topic?.csvId ?? '')
      .split(',')
      .map((id) => id.trim())
      // One line per grammar item, its negative/question variants grouped together
      .map((id) => (CEFRJ_ITEMS[id] ?? []).join(' · '))
      .filter(Boolean)
      .slice(0, MAX_SUBPOINTS);

    try {
      const reply = await this.gemini.lessonReply({
        messages: dto.messages,
        topic: {
          name: topic?.name ?? dto.topicName ?? dto.topicId,
          level: topic?.cefrLevel ?? learnerLevel,
          example: topic?.description,
          subpoints,
        },
        learnerLevel,
        language: user.language === 'en' ? 'en' : 'tr',
      });
      return { reply };
    } catch {
      throw new ServiceUnavailableException({ code: 'LESSON_UNAVAILABLE', message: 'Octo could not answer right now' });
    }
  }
}
