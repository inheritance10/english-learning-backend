import { Controller, Get, Post, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetTopicsUseCase } from '../../application/topics/use-cases/get-topics.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCompletedTopicEntity } from '../../domain/entities/user-completed-topic.entity';

class CompleteTopicDto {
  @IsString()
  topicId: string;

  @IsString()
  topicName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  cefrLevel?: string;
}

@ApiTags('topics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('topics')
export class TopicsController {
  constructor(
    private readonly getTopics: GetTopicsUseCase,
    @InjectRepository(UserCompletedTopicEntity)
    private readonly completedRepo: Repository<UserCompletedTopicEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List topics with optional filters and pagination' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'level', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @CurrentUser() user: UserEntity,
    @Query('category') category?: string,
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.getTopics.execute({
      category,
      cefrLevel: level,
      search,
      page,
      limit,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'List topic categories' })
  async getCategories() {
    return this.getTopics.getCategories('en');
  }

  @Get('levels')
  @ApiOperation({ summary: 'List CEFR levels' })
  async getLevels() {
    return this.getTopics.getLevels();
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark a topic as completed' })
  async completeTopic(@CurrentUser() user: UserEntity, @Body() dto: CompleteTopicDto) {
    // Check if already completed
    const existing = await this.completedRepo.findOne({
      where: { userId: user.id, topicId: dto.topicId },
    });
    
    if (existing) {
      return { message: 'already_completed', completedAt: existing.completedAt };
    }

    const completed = this.completedRepo.create({
      userId: user.id,
      topicId: dto.topicId,
      topicName: dto.topicName,
      topicCategory: dto.category ?? null,
      cefrLevel: dto.cefrLevel ?? null,
    });
    await this.completedRepo.save(completed);
    
    return { message: 'completed', completedAt: completed.completedAt };
  }

  @Get('completed')
  @ApiOperation({ summary: 'Get completed topics' })
  async getCompletedTopics(@CurrentUser() user: UserEntity) {
    const completed = await this.completedRepo.find({
      where: { userId: user.id },
      order: { completedAt: 'DESC' },
    });
    
    return {
      count: completed.length,
      topics: completed,
    };
  }
}
