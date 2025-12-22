import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { StatsService } from './stats.service';
import { GetDailyScoreDto } from './dtos/get-daily-score.dto';
import { GetMonthlyReportDto } from './dtos/get-monthly-report.dto';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * GET /api/stats/daily
   * 일별 점수 조회
   */
  @Get('daily')
  async getDailyScore(@Req() req: any, @Query() query: GetDailyScoreDto) {
    const userId = req.user?.id || 'test-user-id';
    const date = query.date || new Date().toISOString().split('T')[0];
    return this.statsService.getDailyScore(userId, date);
  }

  /**
   * POST /api/stats/calculate-daily
   * 일별 점수 강제 재계산
   */
  @Post('calculate-daily')
  async calculateDaily(@Req() req: any, @Query() query: GetDailyScoreDto) {
    const userId = req.user?.id || 'test-user-id';
    const date = query.date || new Date().toISOString().split('T')[0];
    return this.statsService.calculateDailyScore(userId, date);
  }

  /**
   * GET /api/stats/monthly
   * 월별 통계 조회
   */
  @Get('monthly')
  async getMonthlyReport(@Req() req: any, @Query() query: GetMonthlyReportDto) {
    const userId = req.user?.id || 'test-user-id';
    return this.statsService.getMonthlyReport(userId, query.year, query.month);
  }

  /**
   * GET /api/stats/summary
   * 전체 요약 통계
   */
  @Get('summary')
  async getSummary(@Req() req: any) {
    const userId = req.user?.id || 'test-user-id';
    return this.statsService.getSummary(userId);
  }

  /**
   * GET /api/stats/my-status
   * 내 상태 (My Status) 대시보드 데이터
   */
  @Get('my-status')
  async getMyStatus(@Req() req: any) {
    const userId = req.user?.id || 'test-user-id';
    return this.statsService.getMyStatus(userId);
  }
}
