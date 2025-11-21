import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';

export class GetPointHistoryDto {
  @IsOptional()
  @IsIn(['earn', 'spend', 'expire'])
  type?: string;

  @IsOptional()
  @IsInt()
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  offset?: number = 0;
}
