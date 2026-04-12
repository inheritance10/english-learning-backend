import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicEntity } from '../../domain/entities/topic.entity';

@Injectable()
export class TopicRepository {
  constructor(
    @InjectRepository(TopicEntity)
    private readonly repo: Repository<TopicEntity>,
  ) {}

  findAll(filters?: { category?: string; cefrLevel?: string }) {
    const where: any = { isActive: true };
    if (filters?.category) where.category = filters.category;
    if (filters?.cefrLevel) where.cefrLevel = filters.cefrLevel;
    return this.repo.find({ where, order: { orderIndex: 'ASC' } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByLevel(cefrLevel: string) {
    return this.repo.find({ where: { cefrLevel, isActive: true }, order: { orderIndex: 'ASC' } });
  }

  findByCategory(category: string) {
    return this.repo.find({ where: { category, isActive: true }, order: { orderIndex: 'ASC' } });
  }
}
