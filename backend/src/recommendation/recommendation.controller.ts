import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('daily')
  async getDailyContent(@Query('userId') userId: string) {
    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }
    return this.recommendationService.getDailyContent(userId);
  }
}
