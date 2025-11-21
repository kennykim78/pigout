import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { AiService } from './ai.service';
import { AnalyzeImageDto } from './dtos/analyze-image.dto';
import { AnalyzeTextDto } from './dtos/analyze-text.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * 이미지 분석 엔드포인트
   * POST /api/ai/analyze-image
   */
  @Post('analyze-image')
  @HttpCode(HttpStatus.OK)
  async analyzeImage(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: AnalyzeImageDto,
  ) {
    return this.aiService.analyzeImage(dto);
  }

  /**
   * 텍스트 분석 엔드포인트
   * POST /api/ai/analyze-text
   */
  @Post('analyze-text')
  @HttpCode(HttpStatus.OK)
  async analyzeText(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: AnalyzeTextDto,
  ) {
    return this.aiService.analyzeText(dto);
  }

  /**
   * 상세 분석 조회 엔드포인트
   * GET /api/ai/detail/:recordId
   */
  @Get('detail/:recordId')
  async getDetailedAnalysis(@Param('recordId') recordId: string) {
    return this.aiService.getDetailedAnalysis(recordId);
  }
}
