import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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
      language: user.language,
      page,
      limit,
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
