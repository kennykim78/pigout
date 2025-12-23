import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { StatsService } from "./stats.service";
import { UsersService } from "../users/users.service";
import { GetDailyScoreDto } from "./dtos/get-daily-score.dto";
import { GetMonthlyReportDto } from "./dtos/get-monthly-report.dto";

@Controller("stats")
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly usersService: UsersService
  ) {}

  /**
   * GET /api/stats/daily
   * 일별 점수 조회
   */
  @Get("daily")
  async getDailyScore(
    @Headers("x-device-id") deviceId: string,
    @Query() query: GetDailyScoreDto
  ) {
    const userId = await this.getUserId(deviceId);
    const date = query.date || new Date().toISOString().split("T")[0];
    return this.statsService.getDailyScore(userId, date);
  }

  /**
   * POST /api/stats/calculate-daily
   * 일별 점수 강제 재계산
   */
  @Post("calculate-daily")
  async calculateDaily(
    @Headers("x-device-id") deviceId: string,
    @Query() query: GetDailyScoreDto
  ) {
    const userId = await this.getUserId(deviceId);
    const date = query.date || new Date().toISOString().split("T")[0];
    return this.statsService.calculateDailyScore(userId, date);
  }

  /**
   * GET /api/stats/monthly
   * 월별 통계 조회
   */
  @Get("monthly")
  async getMonthlyReport(
    @Headers("x-device-id") deviceId: string,
    @Query() query: GetMonthlyReportDto
  ) {
    const userId = await this.getUserId(deviceId);
    return this.statsService.getMonthlyReport(userId, query.year, query.month);
  }

  /**
   * GET /api/stats/summary
   * 전체 요약 통계
   */
  @Get("summary")
  async getSummary(@Headers("x-device-id") deviceId: string) {
    const userId = await this.getUserId(deviceId);
    return this.statsService.getSummary(userId);
  }

  /**
   * GET /api/stats/my-status
   * 내 상태 (My Status) 대시보드 데이터
   */
  @Get("my-status")
  async getMyStatus(
    @Headers("x-device-id") deviceId: string,
    @Query("age") age?: string,
    @Query("gender") gender?: string,
    @Query("diseases") diseases?: string
  ) {
    const userId = await this.getUserId(deviceId);

    const userProfile = {
      age: age ? parseInt(age) : undefined,
      gender: gender || undefined,
      diseases: diseases ? JSON.parse(diseases) : undefined,
    };

    return this.statsService.getMyStatus(userId, userProfile);
  }

  /**
   * POST /api/stats/log-activity
   * 활동 로그 기록 (보너스 포인트)
   */
  @Post("log-activity")
  async logActivity(
    @Headers("x-device-id") deviceId: string,
    @Body()
    body: {
      activityType: string;
      referenceId?: string;
      referenceName?: string;
      lifeChangeDays?: number;
    }
  ) {
    const userId = await this.getUserId(deviceId);
    return this.statsService.logActivity(
      userId,
      body.activityType,
      body.referenceId,
      body.referenceName,
      body.lifeChangeDays
    );
  }

  /**
   * Helper: deviceId로 userId 조회
   */
  private async getUserId(deviceId: string): Promise<string> {
    if (!deviceId) {
      throw new HttpException("Device ID is required", HttpStatus.BAD_REQUEST);
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId) {
      throw new HttpException("Unregistered device", HttpStatus.NOT_FOUND);
    }

    return userId;
  }
}
