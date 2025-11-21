import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { RewardService } from './reward.service';
import { ClaimRewardDto } from './dtos/claim-reward.dto';
import { GetPointHistoryDto } from './dtos/get-point-history.dto';

@Controller('reward')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  /**
   * GET /api/reward/points
   * 사용자 포인트 조회
   */
  @Get('points')
  async getPoints(@Req() req: any) {
    const userId = req.user?.id || 'test-user-id'; // Auth guard 추가 시 수정
    return this.rewardService.getUserPoints(userId);
  }

  /**
   * GET /api/reward/items
   * 교환 가능한 리워드 목록
   */
  @Get('items')
  async getRewardItems() {
    return this.rewardService.getAvailableRewards();
  }

  /**
   * POST /api/reward/claim
   * 리워드 교환
   */
  @Post('claim')
  async claimReward(@Req() req: any, @Body() claimDto: ClaimRewardDto) {
    const userId = req.user?.id || 'test-user-id';
    return this.rewardService.claimReward(userId, claimDto.rewardId);
  }

  /**
   * GET /api/reward/history
   * 포인트 내역 조회
   */
  @Get('history')
  async getHistory(@Req() req: any, @Query() query: GetPointHistoryDto) {
    const userId = req.user?.id || 'test-user-id';
    return this.rewardService.getPointHistory(
      userId,
      query.type,
      query.limit,
      query.offset,
    );
  }
}
