import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class SearchMedicineDto {
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
