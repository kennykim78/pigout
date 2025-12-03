import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AnalyzeMedicineImageDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;  // Base64 인코딩된 이미지 데이터

  @IsString()
  @IsOptional()
  mimeType?: string;  // 이미지 MIME 타입 (기본: image/jpeg)
}
