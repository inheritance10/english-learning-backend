import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MailService } from '../../infrastructure/mail/mail.service';
import { QUESTION_POOL_QUEUE } from '../question-pool/question-pool.producer';
import { WORD_BOOSTER_QUEUE } from '../notifications/word-booster.producer';
import { EXAM_PREP_QUEUE } from '../exam-prep/exam-prep.producer';

export interface Alert {
  level: 'critical' | 'warning';
  title: string;
  detail: string;
}

const QUEUE_FAILURE_LIMIT = 20;
const EMAIL_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Turns the raw numbers into a short list of things that need attention. */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private lastMailedKey = '';
  private lastMailedAt = 0;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectQueue(QUESTION_POOL_QUEUE) private readonly poolQueue: Queue,
    @InjectQueue(WORD_BOOSTER_QUEUE) private readonly wordQueue: Queue,
    @InjectQueue(EXAM_PREP_QUEUE) private readonly examQueue: Queue,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async evaluate(): Promise<Alert[]> {
    const [api15, api24, aiQuota, aiHour, jobs24] = await Promise.all([
      this.db.query(`SELECT COUNT(*)::int AS n FROM api_errors WHERE status_code >= 500 AND created_at > now() - interval '15 minutes'`),
      this.db.query(`SELECT COUNT(*)::int AS n FROM api_errors WHERE status_code >= 500 AND created_at > now() - interval '24 hours'`),
      this.db.query(`SELECT COUNT(*)::int AS n, MAX(substring(error from '\\[(\\d{3})')) AS code FROM ai_usage_logs
                      WHERE NOT ok AND created_at > now() - interval '1 hour' AND substring(error from '\\[(\\d{3})') IN ('402','403','429')`),
      this.db.query(`SELECT COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE NOT ok)::int AS errors FROM ai_usage_logs WHERE created_at > now() - interval '1 hour'`),
      this.db.query(`SELECT COUNT(*)::int AS n FROM job_runs WHERE status = 'failed' AND started_at > now() - interval '24 hours'`),
    ]);
    const queues = await Promise.all([this.poolQueue, this.wordQueue, this.examQueue].map((q) => q.getFailedCount()));

    const alerts: Alert[] = [];
    if (api15[0].n >= 5) alerts.push({ level: 'critical', title: 'Sunucu hataları arttı', detail: `Son 15 dakikada ${api15[0].n} adet 5xx hatası.` });
    if (aiQuota[0].n > 0) {
      alerts.push({
        level: 'critical',
        title: 'Gemini kredi/kota hatası',
        detail: `Son 1 saatte ${aiQuota[0].n} adet ${aiQuota[0].code} hatası (kredi bitmiş veya kota aşılmış olabilir). AI Studio'da bakiyeyi kontrol et.`,
      });
    }
    const failedQueues = ['question-pool', 'word-booster', 'exam-prep'].map((name, i) => ({ name, n: queues[i] }));
    for (const q of failedQueues) {
      if (q.n > QUEUE_FAILURE_LIMIT) alerts.push({ level: 'critical', title: `Kuyrukta çok hata: ${q.name}`, detail: `${q.n} iş başarısız.` });
      else if (q.n > 0) alerts.push({ level: 'warning', title: `Kuyrukta hata: ${q.name}`, detail: `${q.n} iş başarısız.` });
    }
    if (aiHour[0].calls >= 10 && aiHour[0].errors / aiHour[0].calls > 0.2) {
      alerts.push({ level: 'warning', title: 'Yapay zeka hata oranı yüksek', detail: `Son 1 saatte ${aiHour[0].errors}/${aiHour[0].calls} çağrı hatalı.` });
    }
    if (api24[0].n > 0 && api15[0].n < 5) alerts.push({ level: 'warning', title: 'Son 24 saatte sunucu hataları', detail: `${api24[0].n} adet 5xx hatası.` });
    if (jobs24[0].n > 0) alerts.push({ level: 'warning', title: 'Arka plan işi hataları', detail: `Son 24 saatte ${jobs24[0].n} başarısız çalışma.` });
    return alerts;
  }

  /** Emails critical alerts; the same set is not re-sent for two hours. */
  @Cron('*/10 * * * *', { timeZone: 'Europe/Istanbul' })
  async notifyCritical(): Promise<void> {
    const critical = (await this.evaluate()).filter((a) => a.level === 'critical');
    if (critical.length === 0) return;
    const key = critical.map((a) => a.title).sort().join('|');
    if (key === this.lastMailedKey && Date.now() - this.lastMailedAt < EMAIL_COOLDOWN_MS) return;

    const to = this.config.get<string>('ALERT_EMAIL') ?? this.config.get<string>('FEEDBACK_TO') ?? 'ali.cebeci@cybersocietyforce.com';
    try {
      await this.mail.send({
        to,
        subject: `[Learn with Octo] Kritik uyarı: ${critical[0].title}`,
        text: critical.map((a) => `• ${a.title}\n  ${a.detail}`).join('\n\n') + '\n\nPanel: Genel ve Hatalar sekmeleri.',
      });
      this.lastMailedKey = key;
      this.lastMailedAt = Date.now();
    } catch (err: any) {
      this.logger.error(`Alert mail failed: ${err?.message}`);
    }
  }
}
