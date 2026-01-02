import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Delete,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { LoungeService } from "./lounge.service";
import { UsersService } from "../users/users.service";

@Controller("lounge")
export class LoungeController {
  constructor(
    private readonly loungeService: LoungeService,
    private readonly usersService: UsersService
  ) {}

  // 피드 목록 조회
  @Get("feed")
  async getFeed(
    @Headers("X-Device-Id") deviceId: string,
    @Query("limit") limit: number = 20,
    @Query("offset") offset: number = 0,
    @Query("sort") sort: string = "latest" // latest, popular
  ) {
    if (!deviceId)
      throw new HttpException("Device ID missing", HttpStatus.BAD_REQUEST);

    // 사용자 식별 (로그인 안했으면 익명 처리 또는 에러, 여기선 deviceId로 조회)
    const userId = await this.usersService.getUserIdFromDeviceId(deviceId);

    return this.loungeService.getFeed(userId, limit, offset, sort);
  }

  // 게시글 작성
  @Post("feed")
  async createPost(
    @Headers("X-Device-Id") deviceId: string,
    @Body()
    body: {
      foodName: string;
      score: number;
      lifeChange: number;
      comment: string;
      imageUrl?: string;
      tags?: string[];
    }
  ) {
    const userId = await this.usersService.getUserIdFromDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.createPost(userId, body);
  }

  // 좋아요 토글
  @Post("feed/:id/like")
  async toggleLike(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") postId: string
  ) {
    const userId = await this.usersService.getUserIdFromDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.toggleLike(userId, postId);
  }

  // 북마크 토글
  @Post("feed/:id/bookmark")
  async toggleBookmark(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") postId: string
  ) {
    const userId = await this.usersService.getUserIdFromDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.toggleBookmark(userId, postId);
  }

  // 신고하기
  @Post("feed/:id/report")
  async reportPost(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") postId: string,
    @Body("reason") reason: string
  ) {
    const userId = await this.usersService.getUserIdFromDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    // 익명 신고라도 유저 식별은 필요
    return this.loungeService.reportPost(userId, postId, reason || "기타");
  }
}
