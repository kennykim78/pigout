import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface User {
  id: string;
  device_id: string;
  nickname?: string;
  email?: string;
  phone?: string;
  diseases?: string[];
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * 기기 ID로 사용자 조회 또는 생성
   * - 기기 ID가 이미 등록되어 있으면 해당 사용자 반환
   * - 없으면 새 사용자 생성
   */
  async findOrCreateByDeviceId(deviceId: string): Promise<User> {
    const client = this.supabaseService.getClient();

    // 기존 사용자 조회
    const { data: existingUser, error: findError } = await client
      .from('users')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (existingUser) {
      // 마지막 활동 시간 업데이트
      await client
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', existingUser.id);
      
      console.log(`[Users] 기존 사용자 반환: ${existingUser.id}`);
      return existingUser;
    }

    // 새 사용자 생성
    const { data: newUser, error: createError } = await client
      .from('users')
      .insert({
        device_id: deviceId,
        nickname: `사용자_${deviceId.substring(0, 8)}`,
        is_verified: false,
        diseases: [],
      })
      .select()
      .single();

    if (createError) {
      console.error('[Users] 사용자 생성 실패:', createError);
      throw createError;
    }

    console.log(`[Users] 새 사용자 생성: ${newUser.id}`);
    return newUser;
  }

  /**
   * 기기 ID로 사용자 ID 조회
   */
  async getUserIdByDeviceId(deviceId: string): Promise<string | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .select('id')
      .eq('device_id', deviceId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  }

  /**
   * 사용자 ID로 조회
   */
  async findById(userId: string): Promise<User | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * 사용자 프로필 업데이트
   */
  async updateProfile(
    userId: string,
    updates: { nickname?: string; diseases?: string[] }
  ): Promise<User> {
    const client = this.supabaseService.getClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.nickname !== undefined) {
      updateData.nickname = updates.nickname;
    }
    if (updates.diseases !== undefined) {
      updateData.diseases = updates.diseases;
    }

    const { data, error } = await client
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 이메일 연결 (이후 구현)
   */
  async linkEmail(userId: string, email: string): Promise<User> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .update({
        email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 휴대폰 번호 연결 (이후 구현)
   */
  async linkPhone(userId: string, phone: string): Promise<User> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .update({
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 인증 완료 처리 (이메일 또는 휴대폰 인증 후)
   */
  async markAsVerified(userId: string): Promise<User> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('users')
      .update({
        is_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * 사용자 분석 히스토리 조회 (캐시에서 상세 분석도 가져옴)
   */
  async getAnalysisHistory(userId: string, limit: number = 20, offset: number = 0) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('food_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // 각 분석 결과에 대해 캐시에서 상세 분석 정보 가져오기
    const resultsWithDetails = await Promise.all(
      (data || []).map(async (item: any) => {
        // 캐시 키 생성 (음식명 + 질병 + 빈 약물 - 히스토리에는 약물 정보가 없음)
        const cacheKey = this.supabaseService.generateCacheKey(
          item.food_name || '',
          item.diseases || [],
          [] // 히스토리 조회 시에는 약물 정보 없이 기본 캐시 조회
        );

        // 캐시에서 상세 분석 조회 (히트 카운트 증가 없이)
        const { data: cacheData } = await client
          .from('analysis_cache')
          .select('detailed_analysis')
          .eq('food_name', item.food_name)
          .limit(1)
          .single();

        return {
          ...item,
          detailed_analysis: cacheData?.detailed_analysis || null,
        };
      })
    );

    return resultsWithDetails;
  }

  /**
   * 사용자 약물 기록 조회
   */
  async getMedicineRecords(userId: string, activeOnly: boolean = true) {
    const client = this.supabaseService.getClient();

    let query = client
      .from('medicine_records')
      .select('*')
      .eq('user_id', userId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }
}
