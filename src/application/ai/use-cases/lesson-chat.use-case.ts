import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface LessonChatDto {
  topicId: string;
  topicName?: string; // fallback name if topicId not in DB
  messages: Array<{ role: 'user' | 'model'; content: string }>;
}

@Injectable()
export class LessonChatUseCase {
  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async execute(dto: LessonChatDto, user: UserEntity): Promise<{ reply: string }> {
    // Skip DB lookup for non-UUID topicIds (e.g. fallback IDs like 'f1')
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = UUID_REGEX.test(dto.topicId);
    const topic = isValidUuid
      ? await this.topicRepo.findOne({ where: { id: dto.topicId } })
      : null;
    const topicName = topic?.name ?? dto.topicName ?? dto.topicId;

    // Collect full streaming response into a single string
    let fullReply = '';
    const stream = this.gemini.streamLessonChat({
      messages: dto.messages,
      topic: topicName,
      cefrLevel: user.cefrLevel ?? 'B1',
      language: user.language as 'en' | 'tr',
    });

    for await (const chunk of stream) {
      fullReply += chunk;
    }

    return { reply: fullReply };
  }
}
