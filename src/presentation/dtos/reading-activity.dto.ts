import { IsString, IsOptional, IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class GenerateReadingDto {
  @IsString()
  interest: string;

  @IsOptional()
  @IsString()
  cefrLevel?: string;
}

export class SubmitReadingDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  answers: number[];
}
