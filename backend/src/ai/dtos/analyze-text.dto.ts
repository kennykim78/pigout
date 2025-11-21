import { IsString, IsArray, ArrayMinSize, ArrayMaxSize, IsNotEmpty } from 'class-validator';

export class AnalyzeTextDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  diseases: string[];

  @IsString()
  @IsNotEmpty()
  textInput: string;
}
