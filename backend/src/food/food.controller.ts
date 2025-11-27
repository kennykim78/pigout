import { Controller, Post, Get, Body, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FoodService } from './food.service';

@Controller('food')
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

  // 전체 분석 (공공데이터 포함) - 자세히 보기용
  @Post('analyze')
  @UseInterceptors(FileInterceptor('image'))
  async analyzeFood(
    @Body('foodName') foodName: string,
    @Body('diseases') diseases: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    // diseases가 JSON 문자열로 전달되므로 파싱
    const diseasesArray = diseases ? JSON.parse(diseases) : [];
    return this.foodService.analyzeFood(foodName, image, diseasesArray);
  }

  @Get(':id')
  async getFoodAnalysis(@Param('id') id: string) {
    return this.foodService.getFoodAnalysis(id);
  }

  // 전체 텍스트 분석 (공공데이터 포함) - 자세히 보기용
  @Post('text-analyze')
  async analyzeFoodByText(
    @Body('foodName') foodName: string,
    @Body('diseases') diseases?: string[],
  ) {
    return this.foodService.analyzeFoodByText(foodName, diseases || []);
  }

  // 빠른 AI 분석 (공공데이터 없음) - Result01용
  @Post('simple-text-analyze')
  async simpleTextAnalyze(
    @Body('foodName') foodName: string,
    @Body('diseases') diseases?: string[],
  ) {
    return this.foodService.simpleAnalyzeFoodByText(foodName, diseases || []);
  }

  // 빠른 이미지+AI 분석 (공공데이터 없음) - Result01용
  @Post('simple-analyze')
  @UseInterceptors(FileInterceptor('image'))
  async simpleAnalyzeFood(
    @Body('foodName') foodName: string,
    @Body('diseases') diseases: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const diseasesArray = diseases ? JSON.parse(diseases) : [];
    return this.foodService.simpleAnalyzeFood(foodName, image, diseasesArray);
  }

  @Post('quick-analyze')
  async quickAnalyze(@Body('imageBase64') imageBase64: string) {
    return this.foodService.quickAnalyzeImage(imageBase64);
  }
}
