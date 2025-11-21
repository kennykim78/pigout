import { IsDateString, IsOptional } from 'class-validator';

export class GetDailyScoreDto {
  @IsDateString()
  @IsOptional()
  date?: string; // YYYY-MM-DD 형식
}
