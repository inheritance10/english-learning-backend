import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicEntity } from '../../../domain/entities/topic.entity';

export interface TopicFilter {
  category?: string;
  cefrLevel?: string;
  language?: string;
}

@Injectable()
export class GetTopicsUseCase {
  constructor(
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async execute(filter: TopicFilter) {
    const query = this.topicRepo.createQueryBuilder('topic')
      .where('topic.isActive = :active', { active: true });

    if (filter.category) {
      query.andWhere('topic.category = :category', { category: filter.category });
    }
    if (filter.cefrLevel) {
      query.andWhere('topic.cefrLevel = :level', { level: filter.cefrLevel });
    }
    if (filter.language) {
      query.andWhere('topic.language = :lang', { lang: filter.language });
    }

    return query.orderBy('topic.orderIndex', 'ASC').getMany();
  }

  async getCategories(language = 'en') {
    const result = await this.topicRepo
      .createQueryBuilder('topic')
      .select('DISTINCT topic.category', 'category')
      .addSelect('COUNT(topic.id)', 'count')
      .where('topic.isActive = :active', { active: true })
      .andWhere('topic.language = :lang', { lang: language })
      .groupBy('topic.category')
      .getRawMany();

    // Return hardcoded categories with counts
    return [
      { key: 'grammar', label: 'Grammar', icon: 'BookOpen', count: result.find(r => r.category === 'grammar')?.count ?? 0 },
      { key: 'vocabulary', label: 'Vocabulary', icon: 'Type', count: result.find(r => r.category === 'vocabulary')?.count ?? 0 },
      { key: 'business', label: 'Business', icon: 'Briefcase', count: result.find(r => r.category === 'business')?.count ?? 0 },
      { key: 'conversation', label: 'Conversation', icon: 'MessageCircle', count: result.find(r => r.category === 'conversation')?.count ?? 0 },
      { key: 'writing', label: 'Writing', icon: 'PenTool', count: result.find(r => r.category === 'writing')?.count ?? 0 },
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
