import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/** Protects /admin with a shared key (ADMIN_API_KEY). The panel's dev proxy adds the header. */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) throw new ForbiddenException('ADMIN_API_KEY is not configured');

    const given = ctx.switchToHttp().getRequest().headers['x-admin-key'];
    if (typeof given !== 'string') throw new UnauthorizedException();

    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
