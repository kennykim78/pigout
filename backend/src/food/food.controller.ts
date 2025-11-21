import { Controller, Post, Get, Body, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FoodService } from './food.service';

@Controller('food')
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

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

  @Post('text-analyze')
  async analyzeFoodByText(
    @Body('foodName') foodName: string,
    @Body('diseases') diseases?: string[],
  ) {
    return this.foodService.analyzeFoodByText(foodName, diseases || []);
  }

  @Post('quick-analyze')
  async quickAnalyze(@Body('imageBase64') imageBase64: string) {
    return this.foodService.quickAnalyzeImage(imageBase64);
  }
}
