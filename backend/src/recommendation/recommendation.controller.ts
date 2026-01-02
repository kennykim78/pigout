import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { RecommendationService } from "./recommendation.service";
import { UsersService } from "../users/users.service";

@Controller("recommendation")
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly usersService: UsersService
  ) {}

  @Get("daily")
  async getDailyContent(@Headers("x-device-id") deviceId: string) {
    if (!deviceId) {
      throw new HttpException("Device ID is required", HttpStatus.BAD_REQUEST);
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId) {
      throw new HttpException("Unregistered device", HttpStatus.NOT_FOUND);
    }

    return this.recommendationService.getDailyContent(userId);
  }

  // 🔥 음식 랭킹 조회 (최근 7일 인기 음식)
  @Get("ranking")
  async getFoodRanking(@Query("limit") limit: number = 5) {
    return this.recommendationService.getFoodRanking(Number(limit) || 5);
  }

  // ⚖️ 주간 밸런스 게임 조회
  @Get("balance-game")
  async getBalanceGame(@Headers("x-device-id") deviceId: string) {
    if (!deviceId) {
      throw new HttpException("Device ID is required", HttpStatus.BAD_REQUEST);
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId) {
      throw new HttpException("Unregistered device", HttpStatus.NOT_FOUND);
    }

    return this.recommendationService.getWeeklyBalanceGame(userId);
  }

  // ⚖️ 밸런스 게임 투표
  @Post("balance-game/vote")
  async submitVote(
    @Headers("x-device-id") deviceId: string,
    @Body() body: { gameId: string; option: "A" | "B" }
  ) {
    if (!deviceId) {
      throw new HttpException("Device ID is required", HttpStatus.BAD_REQUEST);
    }

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId) {
      throw new HttpException("Unregistered device", HttpStatus.NOT_FOUND);
    }

    if (!body.gameId || !["A", "B"].includes(body.option)) {
      throw new HttpException("Invalid vote data", HttpStatus.BAD_REQUEST);
    }

    return this.recommendationService.submitBalanceVote(
      userId,
      body.gameId,
      body.option
    );
  }
}
