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
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);

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
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
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
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
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
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
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
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    // 익명 신고라도 유저 식별은 필요
    return this.loungeService.reportPost(userId, postId, reason || "기타");
  }

  // 게시글 수정
  @Post("feed/:id/update")
  async updatePost(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") postId: string,
    @Body() body: { comment?: string; tags?: string[]; imageUrl?: string }
  ) {
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.updatePost(userId, postId, body);
  }

  // 게시글 삭제
  @Delete("feed/:id")
  async deletePost(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") postId: string
  ) {
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.deletePost(userId, postId);
  }

  // 댓글 목록 조회
  @Get("feed/:id/comments")
  async getComments(
    @Param("id") postId: string,
    @Query("limit") limit: number = 20,
    @Query("offset") offset: number = 0
  ) {
    return this.loungeService.getComments(postId, limit, offset);
  }

  // 댓글 작성
  @Post("feed/:id/comments")
  async createComment(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") postId: string,
    @Body("content") content: string
  ) {
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    if (!content || !content.trim()) {
      throw new HttpException(
        "댓글 내용을 입력해주세요.",
        HttpStatus.BAD_REQUEST
      );
    }

    return this.loungeService.createComment(userId, postId, content.trim());
  }

  // 댓글 삭제
  @Delete("comments/:id")
  async deleteComment(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") commentId: string
  ) {
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.deleteComment(userId, commentId);
  }

  // 일반 피드 작성 (음식 무관)
  @Post("feed/general")
  async createGeneralPost(
    @Headers("X-Device-Id") deviceId: string,
    @Body()
    body: {
      comment: string;
      imageUrl?: string;
      tags?: string[];
    }
  ) {
    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    // 일반 피드용 데이터로 변환
    const postData = {
      foodName: null, // 음식 없음
      score: null,
      lifeChange: null,
      comment: body.comment,
      imageUrl: body.imageUrl,
      tags: body.tags || [],
      postType: "general", // 일반 피드 타입
    };

    return this.loungeService.createPost(userId, postData);
  }

  // ==========================================
  // 🔔 알림 API
  // ==========================================

  // 알림 목록 조회
  @Get("notifications")
  async getNotifications(
    @Headers("X-Device-Id") deviceId: string,
    @Query("limit") limit: number = 20,
    @Query("offset") offset: number = 0
  ) {
    if (!deviceId)
      throw new HttpException("Device ID missing", HttpStatus.BAD_REQUEST);

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.getNotifications(
      userId,
      Number(limit),
      Number(offset)
    );
  }

  // 읽지 않은 알림 개수
  @Get("notifications/unread-count")
  async getUnreadCount(@Headers("X-Device-Id") deviceId: string) {
    if (!deviceId)
      throw new HttpException("Device ID missing", HttpStatus.BAD_REQUEST);

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.getUnreadCount(userId);
  }

  // 전체 알림 읽음 처리
  @Post("notifications/read-all")
  async markAllAsRead(@Headers("X-Device-Id") deviceId: string) {
    if (!deviceId)
      throw new HttpException("Device ID missing", HttpStatus.BAD_REQUEST);

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.markAllAsRead(userId);
  }

  // 특정 알림 읽음 처리
  @Post("notifications/:id/read")
  async markAsRead(
    @Headers("X-Device-Id") deviceId: string,
    @Param("id") notificationId: string
  ) {
    if (!deviceId)
      throw new HttpException("Device ID missing", HttpStatus.BAD_REQUEST);

    const userId = await this.usersService.getUserIdByDeviceId(deviceId);
    if (!userId)
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);

    return this.loungeService.markAsRead(userId, notificationId);
  }
}
