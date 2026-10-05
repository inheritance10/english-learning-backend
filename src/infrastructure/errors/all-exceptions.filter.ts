import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ObservabilityService } from '../observability/observability.service';

/** Answers errors the same way Nest does, and records every one for the admin panel. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly obs: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { user?: { id?: string } }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : 500;
    const body: any = isHttp ? exception.getResponse() : null;
    const rawMessage = typeof body === 'string' ? body : body?.message ?? (exception as Error)?.message ?? 'Internal server error';
    const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : String(rawMessage);
    const errorCode = String(body?.code ?? (isHttp ? `HTTP_${status}` : 'UNHANDLED'));

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.originalUrl}: ${message}`, (exception as Error)?.stack);
    }

    this.obs.recordApiError({
      method: req.method,
      path: (req.originalUrl ?? req.url ?? '').split('?')[0].slice(0, 300),
      statusCode: status,
      errorCode: errorCode.slice(0, 80),
      message: message.slice(0, 1000),
      stack: !isHttp && exception instanceof Error ? (exception.stack ?? null) : null,
      userId: req.user?.id ?? null,
    });

    if (res.headersSent) return;
    if (isHttp) {
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
    } else {
      res.status(500).json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}
