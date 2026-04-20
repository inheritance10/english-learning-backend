import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { REDIS_CLIENT } from '../../../infrastructure/redis/redis.module';

export interface TopicFilter {
  category?: string;
  cefrLevel?: string;
  language?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTopics {
  data: TopicEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TOPICS_TTL = 300; // 5 minutes

@Injectable()
export class GetTopicsUseCase {
  private readonly logger = new Logger(GetTopicsUseCase.name);

  constructor(
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async execute(filter: TopicFilter): Promise<PaginatedTopics> {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 50, 100);
    const offset = (page - 1) * limit;

    // Redis cache — skip for search queries (too dynamic)
    const cacheKey = filter.search
      ? null
      : `topics:${filter.cefrLevel ?? 'all'}:${filter.category ?? 'all'}:${filter.language ?? 'en'}:p${page}:l${limit}`;

    if (cacheKey) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit: ${cacheKey}`);
          return JSON.parse(cached);
        }
      } catch {
        // Redis unavailable — fall through to DB
      }
    }

    const query = this.topicRepo.createQueryBuilder('topic')
      .where('topic.isActive = :active', { active: true })
      .select([
        'topic.id', 'topic.name', 'topic.description', 'topic.category',
        'topic.cefrLevel', 'topic.cefrJLevel', 'topic.language',
        'topic.estimatedMinutes', 'topic.icon', 'topic.orderIndex', 'topic.isPremium',
      ]);

    if (filter.category) {
      query.andWhere('topic.category = :category', { category: filter.category });
    }
    if (filter.cefrLevel) {
      query.andWhere('topic.cefrLevel = :level', { level: filter.cefrLevel });
    }
    if (filter.language) {
      query.andWhere('topic.language = :lang', { lang: filter.language });
    }
    if (filter.search) {
      query.andWhere(
        '(LOWER(topic.name) LIKE :search OR LOWER(topic.description) LIKE :search)',
        { search: `%${filter.search.toLowerCase()}%` },
      );
    }

    const [data, total] = await query
      .orderBy('topic.orderIndex', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const result: PaginatedTopics = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Store in cache
    if (cacheKey) {
      this.redis.setex(cacheKey, TOPICS_TTL, JSON.stringify(result)).catch(() => null);
    }

    return result;
  }

  async getCategories(language = 'en') {
    const result = await this.topicRepo
      .createQueryBuilder('topic')
      .select('topic.category', 'category')
      .addSelect('COUNT(topic.id)', 'count')
      .where('topic.isActive = :active', { active: true })
      .andWhere('topic.language = :lang', { lang: language })
      .groupBy('topic.category')
      .getRawMany();

    return [
      { key: 'grammar', label: 'Grammar', icon: 'BookOpen', count: Number(result.find(r => r.category === 'grammar')?.count ?? 0) },
      { key: 'vocabulary', label: 'Vocabulary', icon: 'Type', count: Number(result.find(r => r.category === 'vocabulary')?.count ?? 0) },
      { key: 'business', label: 'Business', icon: 'Briefcase', count: Number(result.find(r => r.category === 'business')?.count ?? 0) },
      { key: 'conversation', label: 'Conversation', icon: 'MessageCircle', count: Number(result.find(r => r.category === 'conversation')?.count ?? 0) },
      { key: 'writing', label: 'Writing', icon: 'PenTool', count: Number(result.find(r => r.category === 'writing')?.count ?? 0) },
    ];
  }

  async getLevels() {
    return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => ({
      key: level,
      label: level,
      description: this.getLevelDescription(level),
    }));
  }

  private getLevelDescription(level: string): string {
    const map: Record<string, string> = {
      A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate',
      B2: 'Upper Intermediate', C1: 'Advanced', C2: 'Proficient',
    };
    return map[level] ?? level;
  }
}
