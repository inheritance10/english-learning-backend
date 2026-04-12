import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetTopicsUseCase } from '../../application/topics/use-cases/get-topics.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';

@ApiTags('topics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('topics')
export class TopicsController {
  constructor(private readonly getTopics: GetTopicsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List topics with optional filters' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'level', required: false })
  async findAll(
    @CurrentUser() user: UserEntity,
    @Query('category') category?: string,
    @Query('level') level?: string,
  ) {
    return this.getTopics.execute({
      category,
      cefrLevel: level,
      language: user.language,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'List topic categories' })
  async getCategories(@CurrentUser() user: UserEntity) {
    return this.getTopics.getCategories(user.language);
  }

  @Get('levels')
  @ApiOperation({ summary: 'List CEFR levels' })
  async getLevels() {
    return this.getTopics.getLevels();
  }
}
