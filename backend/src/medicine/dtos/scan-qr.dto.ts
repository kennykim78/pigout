import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ScanQrDto {
  @IsString()
  @IsNotEmpty()
  qrData: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsString()
  @IsOptional()
  frequency?: string;
}
