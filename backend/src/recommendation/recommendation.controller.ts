import {
  Controller,
  Get,
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
}
