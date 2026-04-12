import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface GenerateQuizDto {
  topicId: string;
  topicName?: string; // fallback name if topicId not in DB
  questionCount?: number;
  cefrLevel?: string; // override user's stored level
}

@Injectable()
export class GenerateQuizUseCase {
  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async execute(dto: GenerateQuizDto, user: UserEntity) {
    // Try to find topic in DB; if topicId is not a valid UUID (e.g. fallback 'f1'), skip DB lookup
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = UUID_REGEX.test(dto.topicId);
    const topic = isValidUuid
      ? await this.topicRepo.findOne({ where: { id: dto.topicId } })
      : null;
    const topicName = topic?.name ?? dto.topicName ?? dto.topicId;

    const questions = await this.gemini.generateQuizQuestions({
      topic: topicName,
      cefrLevel: dto.cefrLevel ?? user.cefrLevel ?? 'B1',
      interests: user.interests ?? [],
      count: dto.questionCount ?? 10,
      language: user.language as 'en' | 'tr',
    });

    return {
      topicId: topic?.id ?? dto.topicId,
      topicName,
      cefrLevel: user.cefrLevel,
      questions,
      totalQuestions: questions.length,
    };
  }
}
