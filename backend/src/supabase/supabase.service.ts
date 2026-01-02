import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private medicineDetailCacheAvailable = true;

  constructor(private configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>("SUPABASE_URL") ||
      process.env.SUPABASE_URL;
    const supabaseKey =
      this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY") ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      this.configService.get<string>("SUPABASE_ANON_KEY") ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // 보다 친절한 오류 메시지 + 가짜 클라이언트 생성 (기본 기능은 비활성)
      console.warn(
        "[Supabase] 환경변수 누락: SUPABASE_URL 또는 SUPABASE_ANON_KEY. Mock 클라이언트 사용"
      );
      // 간단한 mock 객체 (필요 메서드 최소 구현)
      // 실제 호출 시 에러를 던져 문제를 빨리 발견하도록 함
      this.supabase = {
        from: () => ({
          select: () => ({ data: null, error: new Error("Supabase 미설정") }),
          insert: () => ({ data: null, error: new Error("Supabase 미설정") }),
          update: () => ({ data: null, error: new Error("Supabase 미설정") }),
          delete: () => ({ error: new Error("Supabase 미설정") }),
          eq: () => ({ data: null, error: new Error("Supabase 미설정") }),
          in: () => ({ data: null, error: new Error("Supabase 미설정") }),
          order: () => ({ data: null, error: new Error("Supabase 미설정") }),
        }),
        storage: {
          from: () => ({
            upload: () => ({ data: null, error: new Error("Supabase 미설정") }),
            getPublicUrl: () => ({ data: { publicUrl: "" } }),
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

  /**
   * 약품 상세 캐시 테이블이 없을 때 캐시 기능을 조용히 비활성화하여 반복 오류를 막는다.
   */
  private handleMedicineDetailCacheMissing(
    error: any,
    context: string
  ): boolean {
    const message = String(error?.message || error || "").toLowerCase();
    if (message.includes("medicine_detail_cache")) {
      if (this.medicineDetailCacheAvailable) {
        console.warn(
          `[MedicineDetailCache] 테이블 없음 → 캐시 비활성화 (${context}): ${message}`
        );
      }
      this.medicineDetailCacheAvailable = false;
      return true;
    }
    return false;
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
      analysis_mode: data.analysisMode || "full",
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
      .from("food_analysis")
      .insert([dbData])
      .select();

    if (error) {
      console.error("Supabase save error:", error);
      throw new HttpException(
        `데이터베이스 저장 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return result;
  }

  // 음식 정보 조회
  async getFoodAnalysis(id: string) {
    const { data, error } = await this.supabase
      .from("food_analysis")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 동일한 음식 이름의 이미지를 찾음 (최신순)
   */
  async findExistingFoodImage(foodName: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("food_analysis")
        .select("image_url")
        .eq("food_name", foodName)
        .not("image_url", "is", null) // 이미지 있는 것만
        .order("created_at", { ascending: false }) // 최신순
        .limit(1)
        .single();

      if (error || !data) return null;
      return data.image_url;
    } catch (e) {
      return null;
    }
  }

  // 이미지 업로드
  async uploadImage(
    file: Buffer,
    fileName: string,
    bucketName: string = "food-images"
  ) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      throw new HttpException(
        `이미지 업로드 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(bucketName).getPublicUrl(fileName);

    return { path: data.path, publicUrl };
  }

  // ================================================================
  // 캐시 관련 메서드
  // ================================================================

  /**
   * 캐시 키 생성: 음식명 + 질병목록 + 약물목록 + 분석모드의 MD5 해시
   * @param analysisMode 분석 모드 ('quick' | 'full') - Result01과 Result02 캐시 분리용
   */
  generateCacheKey(
    foodName: string,
    diseases: string[],
    medicines: string[],
    analysisMode: string = "full"
  ): string {
    const normalizedFood = foodName.trim().toLowerCase();
    const sortedDiseases = [...diseases].sort().join(",").toLowerCase();
    const sortedMedicines = [...medicines].sort().join(",").toLowerCase();
    const raw = `${normalizedFood}|${sortedDiseases}|${sortedMedicines}|${analysisMode}`;
    return crypto.createHash("md5").update(raw).digest("hex");
  }

  /**
   * 캐시 조회: 동일한 음식+질병+약물 조합이 있으면 반환
   */
  async getCachedAnalysis(cacheKey: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from("analysis_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      // 캐시 히트 카운트 증가 (비동기로 처리)
      this.supabase
        .from("analysis_cache")
        .update({
          hit_count: data.hit_count + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .then(() =>
          console.log(
            `[Cache] 히트: ${data.food_name} (${data.hit_count + 1}회)`
          )
        );

      return data;
    } catch (error) {
      console.warn("[Cache] 조회 실패:", error.message);
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

      const { error } = await this.supabase.from("analysis_cache").upsert(
        [
          {
            cache_key: data.cacheKey,
            food_name: data.foodName,
            diseases: data.diseases,
            medicines: data.medicines,
            score: data.score,
            analysis: data.analysis,
            detailed_analysis: data.detailedAnalysis,
            analysis_mode: data.analysisMode || "quick-ai",
            expires_at: expiresAt.toISOString(),
          },
        ],
        {
          onConflict: "cache_key",
        }
      );

      if (error) {
        console.warn("[Cache] 저장 실패:", error.message);
      } else {
        console.log(
          `[Cache] 저장 완료: ${data.foodName} (키: ${data.cacheKey.substring(
            0,
            8
          )}...)`
        );
      }
    } catch (error) {
      console.warn("[Cache] 저장 중 오류:", error.message);
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStatistics(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("analysis_cache")
        .select("hit_count, created_at, food_name");

      if (error) {
        console.warn("[Cache] 통계 조회 실패:", error.message);
        return null;
      }

      const totalEntries = data.length;
      const totalHits = data.reduce(
        (sum, item) => sum + (item.hit_count || 0),
        0
      );
      const avgHits = totalEntries > 0 ? totalHits / totalEntries : 0;

      return {
        totalEntries,
        totalHits,
        avgHits: avgHits.toFixed(2),
        estimatedSavings: `약 ${(totalHits * 0.01).toFixed(
          2
        )}달러 (AI API 비용 기준)`,
      };
    } catch (error) {
      console.warn("[Cache] 통계 조회 중 오류:", error.message);
      return null;
    }
  }

  /**
   * 음식 규칙 조회 (DB에서)
   */
  async getFoodRule(foodName: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("food_rules")
        .select("*")
        .eq("food_name", foodName)
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
        warnings: data.warnings || [], // 🆕 특별 경고 사항
        cookingTips: data.cooking_tips || [], // 🆕 건강한 조리법/팁
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
        .from("food_rules")
        .select("food_name");

      if (error || !data) {
        return [];
      }

      return data.map((row: any) => row.food_name);
    } catch (error) {
      console.warn("[FoodRule] 전체 목록 조회 실패:", error.message);
      return [];
    }
  }

  // ================================================================
  // Phase 2: 연령대 기반 음식 분석 캐시 (약물 제외)
  // ================================================================

  /**
   * 연령대 그룹화 헬퍼 함수
   */
  private getAgeGroup(age?: number): string {
    if (!age || age < 0) return "미입력";
    if (age < 20) return "10대";
    if (age < 30) return "20대";
    if (age < 40) return "30대";
    if (age < 50) return "40대";
    if (age < 60) return "50대";
    if (age < 70) return "60대";
    return "70대+";
  }

  /**
   * 연령대 기반 음식 분석 캐시 조회 (약물 정보 제외)
   * @param foodName 음식명
   * @param ageGroup 연령대 ('20대', '30대', ...)
   * @param gender 성별 ('male', 'female')
   * @returns 캐시된 분석 결과 또는 null
   */
  async getCachedFoodAnalysis(
    foodName: string,
    ageGroup: string,
    gender: string
  ): Promise<any | null> {
    try {
      // 최근 30일 이내의 캐시만 조회
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await this.supabase
        .from("food_analysis")
        .select("*")
        .eq("food_name", foodName)
        .eq("age_group", ageGroup)
        .eq("gender", gender)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log(`[음식 캐시] 미스: ${foodName} (${ageGroup}, ${gender})`);
        return null;
      }

      console.log(
        `[음식 캐시] 적중: ${foodName} (${ageGroup}, ${gender}) - 토큰 절약`
      );
      return {
        score: data.score,
        analysis: data.analysis,
        detailedAnalysis: data.detailed_analysis_json,
        dataSources: data.data_sources || [],
        isFromFoodRules: data.is_from_food_rules || false,
        cachedAt: data.created_at,
      };
    } catch (error) {
      console.warn("[음식 캐시] 조회 실패:", error.message);
      return null;
    }
  }

  /**
   * 연령대 기반 음식 분석 캐시 저장 (약물 정보 제외)
   * @param data 저장할 분석 데이터
   */
  async saveFoodAnalysisCache(data: {
    foodName: string;
    age?: number;
    gender?: string;
    score: number;
    analysis: string;
    detailedAnalysis: any;
    dataSources: string[];
    isFromFoodRules?: boolean;
    userId?: string;
  }): Promise<void> {
    try {
      const ageGroup = this.getAgeGroup(data.age);

      await this.supabase.from("food_analysis").insert({
        user_id: data.userId,
        food_name: data.foodName,
        age_group: ageGroup,
        gender: data.gender || null,
        score: data.score,
        analysis: data.analysis,
        detailed_analysis_json: data.detailedAnalysis,
        data_sources: data.dataSources,
        is_from_food_rules: data.isFromFoodRules || false,
        created_at: new Date().toISOString(),
      });

      console.log(
        `[음식 캐시] 저장 완료: ${data.foodName} (${ageGroup}, ${data.gender})`
      );
    } catch (error) {
      console.error("[음식 캐시] 저장 실패:", error.message);
      // 캐시 저장 실패는 무시 (핵심 기능 아님)
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
        .from("medicine_cache")
        .select("*")
        .eq("search_keyword", normalizedKeyword)
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
        .from("medicine_cache")
        .update({
          hit_count: (data.hit_count || 0) + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq("id", data.id);

      console.log(
        `[MedicineCache] ✅ 캐시 히트: ${searchKeyword} (${
          data.result_count
        }건, 히트: ${data.hit_count + 1}회)`
      );

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
  async saveMedicineCache(
    searchKeyword: string,
    results: any[],
    source: string
  ): Promise<void> {
    try {
      const normalizedKeyword = searchKeyword.trim().toLowerCase();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6); // 6개월 후 만료

      const { error } = await this.supabase.from("medicine_cache").upsert(
        [
          {
            search_keyword: normalizedKeyword,
            results: results,
            result_count: results.length,
            source: source,
            hit_count: 0,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "search_keyword",
        }
      );

      if (error) {
        console.warn(`[MedicineCache] 저장 실패:`, error.message);
      } else {
        console.log(
          `[MedicineCache] 저장 완료: ${searchKeyword} (${results.length}건, 출처: ${source})`
        );
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
        .from("medicine_cache")
        .delete()
        .eq("search_keyword", normalizedKeyword);

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
        .from("medicine_cache")
        .select("search_keyword, result_count, hit_count, source, created_at");

      if (error || !data) {
        return null;
      }

      const totalEntries = data.length;
      const totalHits = data.reduce(
        (sum, item) => sum + (item.hit_count || 0),
        0
      );
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
  async getMedicineDetailCache(
    itemSeq: string,
    entpName: string
  ): Promise<any> {
    try {
      if (!this.medicineDetailCacheAvailable) {
        return null;
      }

      const cacheKey = `${itemSeq}|${entpName}`.toLowerCase().trim();

      const { data, error } = await this.supabase
        .from("medicine_detail_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .single();

      if (error) {
        if (this.handleMedicineDetailCacheMissing(error, "get")) {
          return null;
        }
        return null;
      }

      if (!data) {
        return null;
      }

      // 캐시 만료 확인 (6개월)
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        console.log(
          `[MedicineDetailCache] 캐시 만료됨: ${itemSeq} / ${entpName}`
        );
        return null;
      }

      // 히트 카운트 증가 및 마지막 조회 시간 업데이트
      try {
        await this.supabase
          .from("medicine_detail_cache")
          .update({
            hit_count: (data.hit_count || 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      } catch (err) {
        console.warn(
          "[MedicineDetailCache] 히트 카운트 업데이트 실패:",
          err.message
        );
      }

      console.log(
        `[MedicineDetailCache] ✅ 캐시 히트: ${itemSeq} (${
          data.hit_count + 1
        }회)`
      );

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
    source: string = "e약은요"
  ): Promise<void> {
    try {
      if (!this.medicineDetailCacheAvailable) {
        return;
      }

      const cacheKey = `${itemSeq}|${entpName}`.toLowerCase().trim();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6); // 6개월 후 만료

      const { error } = await this.supabase
        .from("medicine_detail_cache")
        .upsert(
          [
            {
              cache_key: cacheKey,
              item_seq: itemSeq,
              entp_name: entpName,
              medicine_data: medicineData,
              source: source,
              hit_count: 0,
              expires_at: expiresAt.toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: "cache_key",
          }
        );

      if (error) {
        if (this.handleMedicineDetailCacheMissing(error, "save")) {
          return;
        }
        console.warn(`[MedicineDetailCache] 저장 실패:`, error.message);
      } else {
        console.log(
          `[MedicineDetailCache] 저장 완료: ${itemSeq} / ${entpName} (출처: ${source})`
        );
      }
    } catch (error) {
      if (this.handleMedicineDetailCacheMissing(error, "save")) {
        return;
      }
      console.warn(`[MedicineDetailCache] 저장 오류:`, error.message);
    }
  }

  /**
   * 만료된 약품 캐시 자동 정리 (배치 작업용)
   */
  async cleanupExpiredMedicineCache(): Promise<number> {
    try {
      if (!this.medicineDetailCacheAvailable) {
        return 0;
      }

      const { data, error } = await this.supabase
        .from("medicine_detail_cache")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select("id");

      if (error) {
        if (this.handleMedicineDetailCacheMissing(error, "cleanup")) {
          return 0;
        }
        console.warn(`[MedicineDetailCache] 정리 실패:`, error.message);
        return 0;
      }

      console.log(
        `[MedicineDetailCache] 만료 캐시 ${data?.length || 0}건 삭제됨`
      );
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
      if (!this.medicineDetailCacheAvailable) {
        return null;
      }

      const { data, error } = await this.supabase
        .from("medicine_detail_cache")
        .select("item_seq, entp_name, hit_count, source, created_at");

      if (error || !data) {
        if (error && this.handleMedicineDetailCacheMissing(error, "stats")) {
          return null;
        }
        return null;
      }

      const totalEntries = data.length;
      const totalHits = data.reduce(
        (sum, item) => sum + (item.hit_count || 0),
        0
      );
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

  /**
   * 질병별 강화 정보 조회 (없으면 자동 생성)
   * - DB에 있는 질병: 즉시 조회
   * - DB에 없는 질병: AI로 생성 후 DB에 저장
   * @param diseaseNames 질병명 배열
   * @param geminiClient Gemini 클라이언트 (자동 생성용)
   * @returns 질병별 강화 정보
   */
  async getDiseaseEnhancedInfo(
    diseaseNames: string[],
    geminiClient?: any
  ): Promise<any[]> {
    try {
      if (!diseaseNames || diseaseNames.length === 0) {
        return [];
      }

      console.log(`[질병 강화 정보] 조회 시작: ${diseaseNames.join(", ")}`);

      // 1. DB에서 조회
      const { data, error } = await this.supabase
        .from("disease_enhanced_info")
        .select("*")
        .in("disease_name", diseaseNames);

      if (error) {
        console.error(`[질병 강화 정보] 조회 오류:`, error);
        return [];
      }

      const foundDiseases = data || [];
      const foundNames = foundDiseases.map((d) => d.disease_name);
      const missingNames = diseaseNames.filter(
        (name) => !foundNames.includes(name)
      );

      console.log(
        `[질병 강화 정보] DB 조회: ${foundDiseases.length}개 / 미등록: ${missingNames.length}개`
      );

      // 2. DB에 없는 질병이 있고 geminiClient가 제공된 경우 자동 생성
      if (missingNames.length > 0 && geminiClient) {
        console.log(
          `[질병 강화 정보] AI 생성 시작: ${missingNames.join(", ")}`
        );

        const newDiseases = [];
        for (const diseaseName of missingNames) {
          try {
            // AI로 강화 정보 생성
            const enhancedInfo = await geminiClient.generateDiseaseEnhancedInfo(
              diseaseName
            );

            // DB에 저장
            const { data: savedData, error: saveError } = await this.supabase
              .from("disease_enhanced_info")
              .upsert(
                {
                  disease_name: diseaseName,
                  category: enhancedInfo.category,
                  severity: enhancedInfo.severity,
                  chronic_type: enhancedInfo.chronicType,
                  tags: enhancedInfo.tags,
                  recommended_foods: enhancedInfo.recommendedFoods,
                  avoid_foods: enhancedInfo.avoidFoods,
                  caution_foods: enhancedInfo.cautionFoods,
                  dietary_reason: enhancedInfo.dietaryReason,
                  key_nutrients: enhancedInfo.keyNutrients,
                  complication_risks: enhancedInfo.complicationRisks,
                  general_precautions: enhancedInfo.generalPrecautions,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: "disease_name",
                }
              )
              .select();

            if (saveError) {
              console.error(
                `[질병 강화 정보] ${diseaseName} 저장 실패:`,
                saveError.message
              );
            } else if (savedData && savedData.length > 0) {
              console.log(`[질병 강화 정보] ${diseaseName} 생성 및 저장 완료`);
              newDiseases.push(savedData[0]);
            }
          } catch (genError) {
            console.error(
              `[질병 강화 정보] ${diseaseName} 생성 실패:`,
              genError.message
            );
          }
        }

        // 3. 기존 데이터 + 새로 생성된 데이터 반환
        const allDiseases = [...foundDiseases, ...newDiseases];
        console.log(
          `[질병 강화 정보] 총 ${allDiseases.length}개 반환 (DB: ${foundDiseases.length}, 신규: ${newDiseases.length})`
        );
        return allDiseases;
      }

      // geminiClient가 없거나 모든 질병이 DB에 있는 경우
      if (missingNames.length > 0) {
        console.warn(
          `[질병 강화 정보] 미등록 질병 ${
            missingNames.length
          }개 (AI 생성 불가): ${missingNames.join(", ")}`
        );
      }

      console.log(`[질병 강화 정보] ${foundDiseases.length}개 조회 완료`);
      return foundDiseases;
    } catch (error) {
      console.error(`[질병 강화 정보] 예외 발생:`, error.message);
      return [];
    }
  }
}
