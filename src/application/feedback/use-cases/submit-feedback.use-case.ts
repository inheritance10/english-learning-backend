import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { FeedbackEntity, type FeedbackType } from '../../../domain/entities/feedback.entity';
import { UserEntity } from '../../../domain/entities/user.entity';
import { MailService } from '../../../infrastructure/mail/mail.service';

export interface SubmitFeedbackInput {
  type: FeedbackType;
  message: string;
  shareEmail: boolean;
  platform?: string;
  appVersion?: string;
}

const DEFAULT_RECIPIENT = 'ali.cebeci@cybersocietyforce.com';
/** Keeps a single account from flooding the inbox. */
const MAX_PER_HOUR = 5;

const TYPE_LABEL: Record<FeedbackType, string> = {
  suggestion: 'Öneri',
  complaint: 'Şikayet',
  bug: 'Hata bildirimi',
};

@Injectable()
export class SubmitFeedbackUseCase {
  private readonly logger = new Logger(SubmitFeedbackUseCase.name);

  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly repo: Repository<FeedbackEntity>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async execute(input: SubmitFeedbackInput, user: UserEntity): Promise<{ id: string }> {
    const recent = await this.repo.count({
      where: { userId: user.id, createdAt: MoreThanOrEqual(new Date(Date.now() - 3_600_000)) },
    });
    if (recent >= MAX_PER_HOUR) {
      throw new HttpException('Too many messages, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }

    const feedback = await this.repo.save(
      this.repo.create({
        userId: user.id,
        type: input.type,
        message: input.message.trim(),
        contactEmail: input.shareEmail ? user.email : null,
        platform: input.platform ?? null,
        appVersion: input.appVersion ?? null,
      }),
    );

    // Email is best-effort: the feedback is already stored, so a mail failure is only logged
    try {
      const sent = await this.mail.send({
        to: this.config.get<string>('FEEDBACK_TO') ?? DEFAULT_RECIPIENT,
        subject: `[Learn with Octo] ${TYPE_LABEL[input.type]} — ${user.name ?? 'Kullanıcı'}`,
        replyTo: feedback.contactEmail ?? undefined,
        text: [
          `Tür: ${TYPE_LABEL[input.type]}`,
          `Kullanıcı: ${user.name ?? '-'} (${feedback.contactEmail ?? 'e-posta paylaşılmadı'})`,
          `Kullanıcı ID: ${user.id}`,
          `Seviye: ${user.cefrLevel ?? '-'} · Dil: ${user.language ?? '-'}`,
          `Platform: ${feedback.platform ?? '-'} · Sürüm: ${feedback.appVersion ?? '-'}`,
          `Tarih: ${feedback.createdAt.toISOString()}`,
          '',
          feedback.message,
        ].join('\n'),
      });
      if (sent) await this.repo.update(feedback.id, { emailSent: true });
    } catch (err: any) {
      this.logger.error(`Feedback ${feedback.id} saved but email failed: ${err?.message}`);
    }

    return { id: feedback.id };
  }
}
