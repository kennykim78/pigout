import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class AnalyzeInteractionDto {
  @IsArray()
  @IsString({ each: true })
  medicineIds: string[];

  @IsString()
  @IsNotEmpty()
  foodName: string;
}
