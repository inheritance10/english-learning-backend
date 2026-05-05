import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class ImportQuestionDto {
  @IsString()
  examName: string;

  @IsString()
  categoryName: string;

  @IsString()
  content: string;

  @IsArray()
  options: string[];

  @IsNumber()
  correctIndex: number;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  difficultyLevel?: 'easy' | 'medium' | 'hard';

  @IsOptional()
  @IsString()
  topicTag?: string;

  @IsOptional()
  @IsBoolean()
  isOriginal?: boolean;
}
