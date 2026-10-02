import { Controller, Post, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuestionPoolScheduler } from '../../application/question-pool/question-pool.scheduler';

/** Development-only triggers for the question pool crons. Production returns 403. */
@ApiTags('dev / question-pool')
@Controller('dev/question-pool')
export class QuestionPoolController {
  constructor(private readonly scheduler: QuestionPoolScheduler) {}

  @Post('baseline')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '[DEV ONLY] Top every topic up to the base pool size' })
  async baseline() {
    this.assertDev();
    return { queuedQuestions: await this.scheduler.ensureBaseline() };
  }

  @Post('demand')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '[DEV ONLY] Run the usage-based expansion now' })
  async demand() {
    this.assertDev();
    return { queuedQuestions: await this.scheduler.expandByDemand() };
  }

  private assertDev() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Only available in development.');
    }
  }
}
