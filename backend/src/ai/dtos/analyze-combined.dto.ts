import { IsArray, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AnalyzeCombinedDto {
  @IsString()
  @IsNotEmpty()
  foodName: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  medicines?: string[]; // 약물 ID 배열

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supplements?: string[]; // 영양제 목록

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  diseases: string[]; // 질병 목록

  @IsString()
  @IsOptional()
  imageUrl?: string; // 음식 이미지 URL
}
