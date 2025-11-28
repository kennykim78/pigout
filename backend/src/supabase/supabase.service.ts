import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || process.env.SUPABASE_URL;
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // 보다 친절한 오류 메시지 + 가짜 클라이언트 생성 (기본 기능은 비활성)
      console.warn('[Supabase] 환경변수 누락: SUPABASE_URL 또는 SUPABASE_ANON_KEY. Mock 클라이언트 사용');
      // 간단한 mock 객체 (필요 메서드 최소 구현)
      // 실제 호출 시 에러를 던져 문제를 빨리 발견하도록 함
      this.supabase = {
        from: () => ({
          select: () => ({ data: null, error: new Error('Supabase 미설정') }),
          insert: () => ({ data: null, error: new Error('Supabase 미설정') }),
          update: () => ({ data: null, error: new Error('Supabase 미설정') }),
          delete: () => ({ error: new Error('Supabase 미설정') }),
          eq: () => ({ data: null, error: new Error('Supabase 미설정') }),
          in: () => ({ data: null, error: new Error('Supabase 미설정') }),
          order: () => ({ data: null, error: new Error('Supabase 미설정') }),
        }),
        storage: {
          from: () => ({
            upload: () => ({ data: null, error: new Error('Supabase 미설정') }),
            getPublicUrl: () => ({ data: { publicUrl: '' } }),
          }),
        },
      } as any;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // 음식 정보 저장
  async saveFoodAnalysis(data: {
    foodName: string;
    imageUrl?: string;
    score?: number;
    analysis?: string;
    diseases?: string[];
    detailedAnalysis?: string;
    userId?: string;
  }) {
    // camelCase를 snake_case로 변환
    const dbData: any = {
      food_name: data.foodName,
      image_url: data.imageUrl,
      score: data.score,
      analysis: data.analysis,
      diseases: data.diseases || [], // 질병 정보 추가
    };
    
    // userId가 있으면 추가
    if (data.userId) {
      dbData.user_id = data.userId;
    }
    
    // detailedAnalysis가 있으면 추가 (선택적)
    if (data.detailedAnalysis) {
      dbData.detailed_analysis = data.detailedAnalysis;
    }

    const { data: result, error } = await this.supabase
      .from('food_analysis')
      .insert([dbData])
      .select();

    if (error) {
      console.error('Supabase save error:', error);
      throw new HttpException(
        `데이터베이스 저장 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return result;
  }

  // 음식 정보 조회
  async getFoodAnalysis(id: string) {
    const { data, error } = await this.supabase
      .from('food_analysis')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // 이미지 업로드
  async uploadImage(file: Buffer, fileName: string, bucketName: string = 'food-images') {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new HttpException(
        `이미지 업로드 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return { path: data.path, publicUrl };
  }

  // ================================================================
  // 캐시 관련 메서드
  // ================================================================

  /**
   * 캐시 키 생성: 음식명 + 질병목록 + 약물목록의 MD5 해시
   */
  generateCacheKey(foodName: string, diseases: string[], medicines: string[]): string {
    const normalizedFood = foodName.trim().toLowerCase();
    const sortedDiseases = [...diseases].sort().join(',').toLowerCase();
    const sortedMedicines = [...medicines].sort().join(',').toLowerCase();
    const raw = `${normalizedFood}|${sortedDiseases}|${sortedMedicines}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * 캐시 조회: 동일한 음식+질병+약물 조합이 있으면 반환
   */
  async getCachedAnalysis(cacheKey: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('analysis_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      // 캐시 히트 카운트 증가 (비동기로 처리)
      this.supabase
        .from('analysis_cache')
        .update({ 
          hit_count: data.hit_count + 1,
          last_hit_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .then(() => console.log(`[Cache] 히트: ${data.food_name} (${data.hit_count + 1}회)`))
        .catch(err => console.warn('[Cache] 히트 카운트 업데이트 실패:', err));

      return data;
    } catch (error) {
      console.warn('[Cache] 조회 실패:', error.message);
      return null;
    }
  }

  /**
   * 캐시 저장: 분석 결과를 캐시에 저장
   */
  async saveCachedAnalysis(data: {
    cacheKey: string;
    foodName: string;
    diseases: string[];
    medicines: string[];
    score: number;
    analysis: string;
    detailedAnalysis: any;
    analysisMode?: string;
  }): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

      const { error } = await this.supabase
        .from('analysis_cache')
        .upsert([{
          cache_key: data.cacheKey,
          food_name: data.foodName,
          diseases: data.diseases,
          medicines: data.medicines,
          score: data.score,
          analysis: data.analysis,
          detailed_analysis: data.detailedAnalysis,
          analysis_mode: data.analysisMode || 'quick-ai',
          expires_at: expiresAt.toISOString(),
        }], { 
          onConflict: 'cache_key' 
        });

      if (error) {
        console.warn('[Cache] 저장 실패:', error.message);
      } else {
        console.log(`[Cache] 저장 완료: ${data.foodName} (키: ${data.cacheKey.substring(0, 8)}...)`);
      }
    } catch (error) {
      console.warn('[Cache] 저장 중 오류:', error.message);
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStatistics(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('analysis_cache')
        .select('hit_count, created_at, food_name');

      if (error) {
        console.warn('[Cache] 통계 조회 실패:', error.message);
        return null;
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, item) => sum + (item.hit_count || 0), 0);
      const avgHits = totalEntries > 0 ? totalHits / totalEntries : 0;

      return {
        totalEntries,
        totalHits,
        avgHits: avgHits.toFixed(2),
        estimatedSavings: `약 ${(totalHits * 0.01).toFixed(2)}달러 (AI API 비용 기준)`,
      };
    } catch (error) {
      console.warn('[Cache] 통계 조회 중 오류:', error.message);
      return null;
    }
  }
}
