import { Controller, Post, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuestionPoolScheduler } from '../../application/question-pool/question-pool.scheduler';

/**
 * Yalnızca geliştirme ortamında kullanılabilen soru havuzu yönetim endpoint'leri.
 * Production'da tüm istekler 403 döner.
 */
@ApiTags('dev / question-pool')
@Controller('dev/question-pool')
export class QuestionPoolController {
  constructor(private readonly scheduler: QuestionPoolScheduler) {}

  @Post('refill')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '[DEV ONLY] Soru havuzu cron\'unu manuel tetikle' })
  async triggerRefill() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Bu endpoint yalnızca development ortamında kullanılabilir.');
    }

    // Cron'u doğrudan çağır — await etmiyoruz; uzun sürebilir
    this.scheduler.refillPool().catch(() => {
      // hata loglanıyor, response'u bloklamıyoruz
    });

    return {
      message: 'Refill job kuyruğa ekleniyor… Logları takip edin.',
      hint: 'docker compose logs -f backend',
    };
  }
}
