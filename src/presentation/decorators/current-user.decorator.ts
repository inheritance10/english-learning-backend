import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../domain/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
