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
    analysisMode?: string;
  }) {
    // camelCase를 snake_case로 변환
    const dbData: any = {
      food_name: data.foodName,
      image_url: data.imageUrl,
      score: data.score,
      analysis: data.analysis,
      diseases: data.diseases || [], // 질병 정보 추가
      analysis_mode: data.analysisMode || 'full',
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
   * 캐시 키 생성: 음식명 + 질병목록 + 약물목록 + 분석모드의 MD5 해시
   * @param analysisMode 분석 모드 ('quick' | 'full') - Result01과 Result02 캐시 분리용
   */
  generateCacheKey(foodName: string, diseases: string[], medicines: string[], analysisMode: string = 'full'): string {
    const normalizedFood = foodName.trim().toLowerCase();
    const sortedDiseases = [...diseases].sort().join(',').toLowerCase();
    const sortedMedicines = [...medicines].sort().join(',').toLowerCase();
    const raw = `${normalizedFood}|${sortedDiseases}|${sortedMedicines}|${analysisMode}`;
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
        .then(() => console.log(`[Cache] 히트: ${data.food_name} (${data.hit_count + 1}회)`));

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

  /**
   * 음식 규칙 조회 (DB에서)
   */
  async getFoodRule(foodName: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('food_rules')
        .select('*')
        .eq('food_name', foodName)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        baseScore: data.base_score,
        summary: data.summary,
        pros: data.pros,
        cons: data.cons,
        expertAdvice: data.expert_advice,
        nutrients: data.nutrients,
        diseaseAnalysis: data.disease_analysis,
      };
    } catch (error) {
      console.warn(`[FoodRule] ${foodName} 조회 실패:`, error.message);
      return null;
    }
  }

  /**
   * 모든 음식 규칙 이름 조회 (캐싱용)
   */
  async getAllFoodRuleNames(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('food_rules')
        .select('food_name');

      if (error || !data) {
        return [];
      }

      return data.map((row: any) => row.food_name);
    } catch (error) {
      console.warn('[FoodRule] 전체 목록 조회 실패:', error.message);
      return [];
    }
  }

  // ================================================================
  // 의약품 검색 결과 캐싱 (API 호출 절약)
  // ================================================================

  /**
   * 의약품 검색 캐시 조회
   * @param searchKeyword 검색 키워드
   * @returns 캐시된 검색 결과 또는 null
   */
  async getMedicineCached(searchKeyword: string): Promise<any[] | null> {
    try {
      const normalizedKeyword = searchKeyword.trim().toLowerCase();
      
      const { data, error } = await this.supabase
        .from('medicine_cache')
        .select('*')
        .eq('search_keyword', normalizedKeyword)
        .single();

      if (error || !data) {
        return null;
      }

      // 캐시 만료 확인 (6개월)
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        console.log(`[MedicineCache] 캐시 만료됨: ${searchKeyword}`);
        return null;
      }

      // 히트 카운트 증가
      await this.supabase
        .from('medicine_cache')
        .update({ 
          hit_count: (data.hit_count || 0) + 1,
          last_hit_at: new Date().toISOString()
        })
        .eq('id', data.id);

      console.log(`[MedicineCache] ✅ 캐시 히트: ${searchKeyword} (${data.result_count}건, 히트: ${data.hit_count + 1}회)`);
      
      return data.results;
    } catch (error) {
      console.warn(`[MedicineCache] 조회 오류:`, error.message);
      return null;
    }
  }

  /**
   * 의약품 검색 결과 캐시 저장
   * @param searchKeyword 검색 키워드
   * @param results 검색 결과 배열
   * @param source 데이터 출처 (e약은요, 의약품허가, 건강기능식품, AI)
   */
  async saveMedicineCache(searchKeyword: string, results: any[], source: string): Promise<void> {
    try {
      const normalizedKeyword = searchKeyword.trim().toLowerCase();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6); // 6개월 후 만료

      const { error } = await this.supabase
        .from('medicine_cache')
        .upsert([{
          search_keyword: normalizedKeyword,
          results: results,
          result_count: results.length,
          source: source,
          hit_count: 0,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
        }], {
          onConflict: 'search_keyword'
        });

      if (error) {
        console.warn(`[MedicineCache] 저장 실패:`, error.message);
      } else {
        console.log(`[MedicineCache] 저장 완료: ${searchKeyword} (${results.length}건, 출처: ${source})`);
      }
    } catch (error) {
      console.warn(`[MedicineCache] 저장 오류:`, error.message);
    }
  }

  /**
   * 무효한 의약품 캐시 삭제
   * @param searchKeyword 검색 키워드
   */
  async deleteMedicineCache(searchKeyword: string): Promise<void> {
    try {
      const normalizedKeyword = searchKeyword.trim().toLowerCase();
      
      const { error } = await this.supabase
        .from('medicine_cache')
        .delete()
        .eq('search_keyword', normalizedKeyword);

      if (error) {
        console.warn(`[MedicineCache] 삭제 실패:`, error.message);
      } else {
        console.log(`[MedicineCache] 무효 캐시 삭제: ${searchKeyword}`);
      }
    } catch (error) {
      console.warn(`[MedicineCache] 삭제 오류:`, error.message);
    }
  }

  /**
   * 의약품 캐시 통계 조회
   */
  async getMedicineCacheStatistics(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('medicine_cache')
        .select('search_keyword, result_count, hit_count, source, created_at');

      if (error || !data) {
        return null;
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, item) => sum + (item.hit_count || 0), 0);
      const bySource = data.reduce((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalEntries,
        totalHits,
        apiCallsSaved: totalHits, // 캐시 히트 = API 호출 절약
        bySource,
      };
    } catch (error) {
      console.warn(`[MedicineCache] 통계 조회 오류:`, error.message);
      return null;
    }
  }

  /**
   * 약품 단위 캐시 조회 (itemSeq + entpName 조합)
   * 모든 사용자가 공유하는 공용 캐시
   * @param itemSeq 약품 시리즈 코드
   * @param entpName 제조사명
   * @returns 캐시된 약품 정보 또는 null
   */
  async getMedicineDetailCache(itemSeq: string, entpName: string): Promise<any> {
    try {
      const cacheKey = `${itemSeq}|${entpName}`.toLowerCase().trim();

      const { data, error } = await this.supabase
        .from('medicine_detail_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (error || !data) {
        return null;
      }

      // 캐시 만료 확인 (6개월)
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        console.log(`[MedicineDetailCache] 캐시 만료됨: ${itemSeq} / ${entpName}`);
        return null;
      }

      // 히트 카운트 증가 및 마지막 조회 시간 업데이트
      try {
        await this.supabase
          .from('medicine_detail_cache')
          .update({
            hit_count: (data.hit_count || 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq('id', data.id);
      } catch (err) {
        console.warn('[MedicineDetailCache] 히트 카운트 업데이트 실패:', err.message);
      }

      console.log(`[MedicineDetailCache] ✅ 캐시 히트: ${itemSeq} (${data.hit_count + 1}회)`);
      
      return data.medicine_data;
    } catch (error) {
      console.warn(`[MedicineDetailCache] 조회 오류:`, error.message);
      return null;
    }
  }

  /**
   * 약품 단위 캐시 저장
   * 공용 캐시: 모든 사용자가 동일 약품(itemSeq+entpName)을 조회 시 활용
   * @param itemSeq 약품 시리즈 코드
   * @param entpName 제조사명
   * @param medicineData 완전한 약품 정보 (efcyQesitm, useMethodQesitm, seQesitm, etc.)
   * @param source 데이터 출처 (e약은요, 건강기능식품, AI)
   */
  async saveMedicineDetailCache(
    itemSeq: string,
    entpName: string,
    medicineData: any,
    source: string = 'e약은요',
  ): Promise<void> {
    try {
      const cacheKey = `${itemSeq}|${entpName}`.toLowerCase().trim();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6); // 6개월 후 만료

      const { error } = await this.supabase
        .from('medicine_detail_cache')
        .upsert(
          [{
            cache_key: cacheKey,
            item_seq: itemSeq,
            entp_name: entpName,
            medicine_data: medicineData,
            source: source,
            hit_count: 0,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
          }],
          {
            onConflict: 'cache_key',
          },
        );

      if (error) {
        console.warn(`[MedicineDetailCache] 저장 실패:`, error.message);
      } else {
        console.log(`[MedicineDetailCache] 저장 완료: ${itemSeq} / ${entpName} (출처: ${source})`);
      }
    } catch (error) {
      console.warn(`[MedicineDetailCache] 저장 오류:`, error.message);
    }
  }

  /**
   * 만료된 약품 캐시 자동 정리 (배치 작업용)
   */
  async cleanupExpiredMedicineCache(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('medicine_detail_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.warn(`[MedicineDetailCache] 정리 실패:`, error.message);
        return 0;
      }

      console.log(`[MedicineDetailCache] 만료 캐시 ${data?.length || 0}건 삭제됨`);
      return data?.length || 0;
    } catch (error) {
      console.warn(`[MedicineDetailCache] 정리 오류:`, error.message);
      return 0;
    }
  }

  /**
   * 약품 캐시 통계
   */
  async getMedicineDetailCacheStatistics(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('medicine_detail_cache')
        .select('item_seq, entp_name, hit_count, source, created_at');

      if (error || !data) {
        return null;
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, item) => sum + (item.hit_count || 0), 0);
      const bySource = data.reduce((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalEntries,
        totalHits,
        apiCallsSaved: totalHits,
        bySource,
      };
    } catch (error) {
      console.warn(`[MedicineDetailCache] 통계 조회 오류:`, error.message);
      return null;
    }
  }
}

