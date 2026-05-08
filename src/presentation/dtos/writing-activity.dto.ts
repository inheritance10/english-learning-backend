import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';
import type { WritingActivityType } from '../../domain/entities/writing-activity.entity';

const ACTIVITY_TYPES: WritingActivityType[] = ['mail', 'picture', 'social', 'chat', 'journal', 'whatif'];

export class GenerateWritingDto {
  @IsString()
  interest: string;

  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @IsOptional()
  @IsIn(ACTIVITY_TYPES)
  activityType?: WritingActivityType;
}

export class SubmitWritingDto {
  @IsString()
  @MinLength(10, { message: 'Cevabın çok kısa. En az 10 karakter yazmalısın.' })
  @MaxLength(2000, { message: 'Cevabın çok uzun (max 2000 karakter).' })
  userText: string;
}
