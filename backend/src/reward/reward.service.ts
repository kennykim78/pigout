import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RewardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * 사용자 포인트 조회
   */
  async getUserPoints(userId: string) {
    const { data: profile, error } = await this.supabaseService
      .getClient()
      .from('user_profiles')
      .select('current_points, lifetime_points_earned, lifetime_points_spent')
      .eq('id', userId)
      .single();

    if (error) {
      // 프로필이 없으면 생성
      if (error.code === 'PGRST116') {
        const { data: newProfile } = await this.supabaseService
          .getClient()
          .from('user_profiles')
          .insert({ id: userId, current_points: 0 })
          .select()
          .single();
        
        return {
          currentPoints: 0,
          lifetimeEarned: 0,
          lifetimeSpent: 0,
        };
      }
      throw error;
    }

    return {
      currentPoints: profile.current_points,
      lifetimeEarned: profile.lifetime_points_earned,
      lifetimeSpent: profile.lifetime_points_spent,
    };
  }

  /**
   * 포인트 적립 (daily score 기반)
   */
  async earnPoints(userId: string, points: number, reason: string, referenceDate: string) {
    const client = this.supabaseService.getClient();

    // 현재 포인트 조회
    const { currentPoints } = await this.getUserPoints(userId);
    const newBalance = currentPoints + points;

    // 트랜잭션으로 처리
    const { error: historyError } = await client
      .from('reward_history')
      .insert({
        user_id: userId,
        type: 'earn',
        points: points,
        reason: reason,
        reference_date: referenceDate,
        balance_after: newBalance,
      });

    if (historyError) throw historyError;

    // 프로필 업데이트
    const { error: profileError } = await client
      .from('user_profiles')
      .update({
        current_points: newBalance,
        lifetime_points_earned: client.rpc('increment', { x: points }),
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    return {
      pointsEarned: points,
      newBalance,
      reason,
    };
  }

  /**
   * 교환 가능한 리워드 목록 조회
   */
  async getAvailableRewards() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('rewards')
      .select('*')
      .eq('is_available', true)
      .order('point_cost', { ascending: true });

    if (error) throw error;

    return data;
  }

  /**
   * 리워드 교환
   */
  async claimReward(userId: string, rewardId: string) {
    const client = this.supabaseService.getClient();

    // 리워드 정보 조회
    const { data: reward, error: rewardError } = await client
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError || !reward) {
      throw new NotFoundException('리워드를 찾을 수 없습니다.');
    }

    if (!reward.is_available) {
      throw new BadRequestException('현재 교환 불가능한 리워드입니다.');
    }

    // 재고 확인
    if (reward.stock_quantity !== null && reward.stock_quantity <= 0) {
      throw new BadRequestException('재고가 부족합니다.');
    }

    // 사용자 포인트 확인
    const { currentPoints } = await this.getUserPoints(userId);

    if (currentPoints < reward.point_cost) {
      throw new BadRequestException(
        `포인트가 부족합니다. (현재: ${currentPoints}, 필요: ${reward.point_cost})`,
      );
    }

    const newBalance = currentPoints - reward.point_cost;

    // 포인트 사용 기록
    const { error: historyError } = await client
      .from('reward_history')
      .insert({
        user_id: userId,
        type: 'spend',
        points: -reward.point_cost,
        reward_id: rewardId,
        reward_name: reward.name,
        balance_after: newBalance,
      });

    if (historyError) throw historyError;

    // 프로필 업데이트
    const { error: profileError } = await client
      .from('user_profiles')
      .update({
        current_points: newBalance,
        lifetime_points_spent: client.rpc('increment', { x: reward.point_cost }),
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    // 재고 차감 (null이 아닌 경우)
    if (reward.stock_quantity !== null) {
      await client
        .from('rewards')
        .update({ stock_quantity: reward.stock_quantity - 1 })
        .eq('id', rewardId);
    }

    return {
      success: true,
      rewardName: reward.name,
      pointsSpent: reward.point_cost,
      remainingPoints: newBalance,
    };
  }

  /**
   * 포인트 내역 조회
   */
  async getPointHistory(userId: string, type?: string, limit: number = 50, offset: number = 0) {
    let query = this.supabaseService
      .getClient()
      .from('reward_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  }
}
