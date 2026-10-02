import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';
import type { WritingMode } from '../../domain/entities/writing-task.entity';

const AVAILABLE_MODES: WritingMode[] = ['build', 'chat', 'story'];

export class StartWritingDto {
  @IsIn(AVAILABLE_MODES)
  mode: WritingMode;

  @IsString()
  interest: string;

  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  cefrLevel?: string;
}

export class SubmitWritingTurnDto {
  @IsString()
  @MinLength(2)
  @MaxLength(400)
  text: string;
}
