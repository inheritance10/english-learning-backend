import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/** Plain-text SMTP mailer. Without SMTP_* settings it logs instead of sending (local dev). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.from = config.get<string>('MAIL_FROM') ?? user ?? 'no-reply@learnwithocto.app';
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT') ?? 587),
          secure: Number(config.get('SMTP_PORT') ?? 587) === 465,
          auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
        })
      : null;
    if (!this.transporter) this.logger.warn('SMTP not configured — emails will only be logged.');
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(params: { to: string; subject: string; text: string; replyTo?: string }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[mail not sent] to=${params.to} subject="${params.subject}"\n${params.text}`);
      return false;
    }
    await this.transporter.sendMail({ from: this.from, ...params });
    return true;
  }
}
