import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { VocabularyItemEntity, VocabularyStatus } from '../../domain/entities/vocabulary-item.entity';

class UpdateVocabDto {
  @IsOptional()
  @IsIn(['new', 'learning', 'mastered'])
  status?: 'new' | 'learning' | 'mastered';
}

@ApiTags('vocabulary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vocabulary')
export class VocabularyController {
  constructor(
    @InjectRepository(VocabularyItemEntity)
    private readonly vocabRepo: Repository<VocabularyItemEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get vocabulary bank items' })
  async findAll(
    @CurrentUser() user: UserEntity,
    @Query('status') status?: string,
  ) {
    const query = this.vocabRepo.createQueryBuilder('vocab')
      .where('vocab.userId = :userId', { userId: user.id });

    if (status) {
      query.andWhere('vocab.status = :status', { status });
    }

    const items = await query.orderBy('vocab.createdAt', 'DESC').getMany();
    const stats = {
      total: items.length,
      new: items.filter(i => i.status === 'new').length,
      learning: items.filter(i => i.status === 'learning').length,
      mastered: items.filter(i => i.status === 'mastered').length,
    };

    return { items, stats };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vocabulary item status' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVocabDto,
    @CurrentUser() user: UserEntity,
  ) {
    const item = await this.vocabRepo.findOne({ where: { id, userId: user.id } });
    if (!item) return null;
    if (dto.status) item.status = dto.status as VocabularyStatus;
    item.reviewCount += 1;
    item.lastReviewedAt = new Date();
    return this.vocabRepo.save(item);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove word from vocabulary bank' })
  async remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    await this.vocabRepo.delete({ id, userId: user.id });
    return { success: true };
  }
}
