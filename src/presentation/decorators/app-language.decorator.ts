import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @AppLanguage() — HTTP isteğindeki Accept-Language header'ından dili okur.
 *
 * Kullanım:
 *   @Get('example')
 *   example(@AppLanguage() lang: 'en' | 'tr') { ... }
 *
 * Not: AI use-case'lerde asıl dil kaynağı user.language (DB)dir.
 * Bu decorator, DB güncellemesinden önce header'dan hızlı okumak için kullanılabilir.
 */
export const AppLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): 'en' | 'tr' => {
    const request = ctx.switchToHttp().getRequest();
    const header: string = request.headers['accept-language'] ?? '';
    // "tr", "tr-TR,tr;q=0.9", "en-US,en;q=0.8" gibi formatları destekle
    const primary = header.split(',')[0].split('-')[0].trim().toLowerCase();
    return primary === 'tr' ? 'tr' : 'en';
  },
);
