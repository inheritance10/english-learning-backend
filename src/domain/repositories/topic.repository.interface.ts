import { TopicEntity } from '../entities/topic.entity';

export interface ITopicRepository {
  findAll(filters?: { category?: string; cefrLevel?: string }): Promise<TopicEntity[]>;
  findById(id: string): Promise<TopicEntity | null>;
  findByLevel(cefrLevel: string): Promise<TopicEntity[]>;
  findByCategory(category: string): Promise<TopicEntity[]>;
}

export const TOPIC_REPOSITORY = 'TOPIC_REPOSITORY';
