import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class StatsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * 일별 점수 계산 및 집계
   */
  async calculateDailyScore(userId: string, date: string) {
    const client = this.supabaseService.getClient();

    // 해당 날짜의 food_records 조회
    const { data: foodRecords } = await client
      .from("food_records")
      .select("score")
      .eq("user_id", userId)
      .gte("created_at", `${date}T00:00:00Z`)
      .lt("created_at", `${date}T23:59:59Z`);

    // 해당 날짜의 combined_records 조회
    const { data: combinedRecords } = await client
      .from("combined_records")
      .select("overall_score")
      .eq("user_id", userId)
      .gte("analyzed_at", `${date}T00:00:00Z`)
      .lt("analyzed_at", `${date}T23:59:59Z`);

    // 음식 점수 집계
    const foodCount = foodRecords?.length || 0;
    const foodTotalScore =
      foodRecords?.reduce((sum, r) => sum + (r.score || 0), 0) || 0;
    const foodAvgScore = foodCount > 0 ? foodTotalScore / foodCount : 0;

    // 종합 점수 집계
    const combinedCount = combinedRecords?.length || 0;
    const combinedTotalScore =
      combinedRecords?.reduce((sum, r) => sum + (r.overall_score || 0), 0) || 0;
    const combinedAvgScore =
      combinedCount > 0 ? combinedTotalScore / combinedCount : 0;

    // 전체 평균 점수
    const overallAvgScore =
      foodCount + combinedCount > 0
        ? (foodTotalScore + combinedTotalScore) / (foodCount + combinedCount)
        : 0;

    // 포인트 획득 여부 판단 (기록용으로 남겨둠, 실제 적립은 없음)
    let pointsEarned = 0;
    let pointRuleApplied = null;

    if (overallAvgScore >= 85) {
      pointsEarned = 10;
      pointRuleApplied = "daily_85";
    } else if (overallAvgScore >= 70) {
      pointsEarned = 5;
      pointRuleApplied = "daily_70";
    }

    // daily_scores 테이블에 저장 (upsert)
    const { data: dailyScore, error } = await client
      .from("daily_scores")
      .upsert(
        {
          user_id: userId,
          date: date,
          food_count: foodCount,
          food_avg_score: foodAvgScore,
          food_total_score: foodTotalScore,
          combined_count: combinedCount,
          combined_avg_score: combinedAvgScore,
          points_earned: pointsEarned,
          point_rule_applied: pointRuleApplied,
        },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) throw error;

    // [DEPRECATED] Reward logic removed
    // if (pointsEarned > 0) {
    //   await this.rewardService.earnPoints(userId, pointsEarned, pointRuleApplied, date);
    // }

    return {
      date,
      overallAvgScore: Math.round(overallAvgScore),
      foodCount,
      combinedCount,
      pointsEarned,
      dailyScore,
    };
  }

  /**
   * 일별 점수 조회
   */
  async getDailyScore(userId: string, date: string) {
    const client = this.supabaseService.getClient();

    // daily_scores에서 조회
    const { data: dailyScore } = await client
      .from("daily_scores")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .single();

    // 없으면 실시간 계산
    if (!dailyScore) {
      return this.calculateDailyScore(userId, date);
    }

    // 해당 날짜의 기록들도 함께 반환
    const { data: foodRecords } = await client
      .from("food_records")
      .select("id, food_name, score, grade, created_at")
      .eq("user_id", userId)
      .gte("created_at", `${date}T00:00:00Z`)
      .lt("created_at", `${date}T23:59:59Z`)
      .order("created_at", { ascending: false });

    const { data: combinedRecords } = await client
      .from("combined_records")
      .select("id, food_name, overall_score, overall_grade, analyzed_at")
      .eq("user_id", userId)
      .gte("analyzed_at", `${date}T00:00:00Z`)
      .lt("analyzed_at", `${date}T23:59:59Z`)
      .order("analyzed_at", { ascending: false });

    return {
      date,
      dailyScore,
      foodRecords: foodRecords || [],
      combinedRecords: combinedRecords || [],
    };
  }

  /**
   * 월별 통계 계산
   */
  async calculateMonthlyReport(userId: string, year: number, month: number) {
    const client = this.supabaseService.getClient();

    // 해당 월의 daily_scores 조회
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data: dailyScores } = await client
      .from("daily_scores")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: true });

    if (!dailyScores || dailyScores.length === 0) {
      return {
        year,
        month,
        totalDays: 0,
        avgScore: 0,
        dailyScores: [],
      };
    }

    // 통계 계산
    const totalDays = dailyScores.length;
    const allScores = dailyScores
      .map(
        (d) =>
          ((d.food_total_score || 0) +
            (d.combined_count || 0) * (d.combined_avg_score || 0)) /
          ((d.food_count || 0) + (d.combined_count || 0) || 1)
      )
      .filter((s) => s > 0);

    const avgScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;
    const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
    const worstScore = allScores.length > 0 ? Math.min(...allScores) : 0;

    const totalPointsEarned = dailyScores.reduce(
      (sum, d) => sum + (d.points_earned || 0),
      0
    );
    const daysAbove70 = allScores.filter((s) => s >= 70).length;
    const daysAbove85 = allScores.filter((s) => s >= 85).length;

    const totalFoodRecords = dailyScores.reduce(
      (sum, d) => sum + (d.food_count || 0),
      0
    );
    const totalCombinedRecords = dailyScores.reduce(
      (sum, d) => sum + (d.combined_count || 0),
      0
    );

    // monthly_scores 테이블에 저장
    const { data: monthlyScore } = await client
      .from("monthly_scores")
      .upsert(
        {
          user_id: userId,
          year,
          month,
          total_days: totalDays,
          avg_score: avgScore,
          best_score: bestScore,
          worst_score: worstScore,
          total_food_records: totalFoodRecords,
          total_combined_records: totalCombinedRecords,
          total_points_earned: totalPointsEarned,
          days_above_70: daysAbove70,
          days_above_85: daysAbove85,
        },
        { onConflict: "user_id,year,month" }
      )
      .select()
      .single();

    return {
      year,
      month,
      monthlyScore,
      dailyScores,
    };
  }

  /**
   * 월별 통계 조회
   */
  async getMonthlyReport(userId: string, year?: number, month?: number) {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    return this.calculateMonthlyReport(userId, targetYear, targetMonth);
  }

  /**
   * 내 상태 (My Status) 대시보드 데이터 조회
   * 1. 총 수명변화 (3년 데이터)
   * 2. 초기기대수명, 현재기대수명, 오늘변화
   * 3. 위트 문구 (DB 기반)
   * 4. 활동 로그 기반 히스토리
   */
  async getMyStatus(
    userId: string,
    userProfile?: { age?: number; gender?: string; diseases?: string[] }
  ) {
    const client = this.supabaseService.getClient();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // 3년 전 날짜 계산
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const threeYearsAgoStr = threeYearsAgo.toISOString().split("T")[0];

    // 1. 3년간 총 수명변화 계산 (food_records + activity_logs)
    const { data: foodScores } = await client
      .from("food_records")
      .select("score, created_at")
      .eq("user_id", userId)
      .gte("created_at", `${threeYearsAgoStr}T00:00:00`);

    // activity_logs 조회 (테이블이 없으면 빈 배열)
    let activityLogs = [];
    try {
      const { data } = await client
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", `${threeYearsAgoStr}T00:00:00`)
        .order("created_at", { ascending: false });
      activityLogs = data || [];
    } catch (e) {
      console.log("[StatsService] activity_logs table not found, skipping");
    }

    // 음식 기록의 수명 변화 (점수 기반)
    let totalLifeChangeDays = 0;
    if (foodScores) {
      totalLifeChangeDays = foodScores.reduce((acc, curr) => {
        return acc + this.scoreToLifeDays(curr.score || 70);
      }, 0);
    }

    // 활동 로그의 보너스 추가
    if (activityLogs) {
      const bonusDays = activityLogs.reduce(
        (acc, log) => acc + (log.life_change_days || 0),
        0
      );
      totalLifeChangeDays += bonusDays;
    }

    // 2. 오늘 수명 변화 계산
    const { data: todayFoodScores } = await client
      .from("food_records")
      .select("score")
      .eq("user_id", userId)
      .gte("created_at", `${todayStr}T00:00:00`)
      .lt("created_at", `${todayStr}T23:59:59`);

    // 오늘 activity_logs 조회 (테이블이 없으면 빈 배열)
    let todayActivityLogs = [];
    try {
      const { data } = await client
        .from("activity_logs")
        .select("life_change_days")
        .eq("user_id", userId)
        .gte("created_at", `${todayStr}T00:00:00`)
        .lt("created_at", `${todayStr}T23:59:59`);
      todayActivityLogs = data || [];
    } catch (e) {
      // 테이블이 없으면 무시
    }

    let todayLifeChangeDays = 0;
    if (todayFoodScores) {
      todayLifeChangeDays = todayFoodScores.reduce((acc, curr) => {
        return acc + this.scoreToLifeDays(curr.score || 70);
      }, 0);
    }
    if (todayActivityLogs) {
      todayLifeChangeDays += todayActivityLogs.reduce(
        (acc, log) => acc + (log.life_change_days || 0),
        0
      );
    }

    // 3. 초기 기대수명 계산 (나이/성별/질병 기반)
    const initialLifeExpectancy = this.calculateInitialLifeExpectancy(
      userProfile?.age,
      userProfile?.gender,
      userProfile?.diseases
    );

    // 4. 현재 기대수명 계산 (초기 + 수명변화를 년도로 변환)
    const lifeChangeYears = totalLifeChangeDays / 365;
    const currentLifeExpectancy = Number(
      (initialLifeExpectancy + lifeChangeYears).toFixed(1)
    );

    // 5. 위트 문구 조회 (테이블이 없으면 기본 메시지)
    let wittyMessage = "🍽️ 오늘도 건강한 식사를 시작해보세요!";
    try {
      const { data: lifeMessage } = await client
        .from("life_messages")
        .select("message, emoji")
        .lte("min_life_expectancy", Math.floor(currentLifeExpectancy))
        .gte("max_life_expectancy", Math.floor(currentLifeExpectancy))
        .limit(1)
        .single();

      if (lifeMessage) {
        wittyMessage = `${lifeMessage.emoji || ""} ${lifeMessage.message}`;
      }
    } catch (e) {
      // 테이블이 없으면 기본 메시지 사용
    }

    // 6. 활동 히스토리 조회 (최근 100건, 일자별 그룹화)
    const historyList = [];

    // food_records를 활동 형태로 변환
    const { data: recentFoodRecords } = await client
      .from("food_records")
      .select("id, food_name, score, created_at, image_path")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (recentFoodRecords) {
      recentFoodRecords.forEach((record) => {
        const lifeDays = this.scoreToLifeDays(record.score || 70);
        historyList.push({
          id: record.id,
          type: "food_analysis",
          name: record.food_name,
          lifeChangeDays: lifeDays,
          createdAt: record.created_at,
          referenceId: record.id,
          imageUrl: record.image_path,
        });
      });
    }

    // activity_logs 추가
    if (activityLogs) {
      activityLogs.slice(0, 50).forEach((log) => {
        historyList.push({
          id: log.id,
          type: log.activity_type,
          name:
            log.reference_name || this.getActivityTypeName(log.activity_type),
          lifeChangeDays: log.life_change_days,
          createdAt: log.created_at,
          referenceId: log.reference_id,
        });
      });
    }

    // 시간순 정렬
    historyList.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 일자별 그룹화
    const groupedHistory = {};
    historyList.slice(0, 100).forEach((item) => {
      const date = new Date(item.createdAt);
      const dateKey = date.toISOString().split("T")[0];
      const timeStr = date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (!groupedHistory[dateKey]) {
        groupedHistory[dateKey] = {
          date: dateKey,
          items: [],
          dailyTotal: 0,
        };
      }

      groupedHistory[dateKey].items.push({
        ...item,
        time: timeStr,
      });
      groupedHistory[dateKey].dailyTotal += item.lifeChangeDays;
    });

    return {
      totalLifeChangeDays: Number(totalLifeChangeDays.toFixed(1)),
      todayLifeChangeDays: Number(todayLifeChangeDays.toFixed(1)),
      initialLifeExpectancy,
      currentLifeExpectancy,
      wittyMessage,
      historyList: Object.values(groupedHistory).slice(0, 30), // 최근 30일
    };
  }

  /**
   * 점수를 수명 일수로 변환 (프론트엔드 lifeScoreUtils와 동일 로직)
   */
  private scoreToLifeDays(score: number): number {
    if (score >= 95) return Math.round(70 + ((score - 95) / 5) * 30);
    if (score >= 85) return Math.round(40 + ((score - 85) / 9) * 29);
    if (score >= 75) return Math.round(15 + ((score - 75) / 9) * 24);
    if (score >= 65) return Math.round(1 + ((score - 65) / 9) * 13);
    if (score >= 50) return -Math.round(1 + ((64 - score) / 14) * 13);
    if (score >= 35) return -Math.round(15 + ((49 - score) / 14) * 24);
    if (score >= 20) return -Math.round(40 + ((34 - score) / 14) * 29);
    return -Math.round(70 + ((19 - score) / 19) * 30);
  }

  /**
   * 초기 기대수명 계산 (나이/성별/질병 기반)
   */
  private calculateInitialLifeExpectancy(
    age?: number,
    gender?: string,
    diseases?: string[]
  ): number {
    // 기본값 (한국 평균 기대수명)
    let baseExpectancy = gender === "female" ? 86.5 : 80.5;

    // 질병별 보정
    const diseaseDeductions: { [key: string]: number } = {
      당뇨: 5,
      당뇨병: 5,
      고혈압: 3,
      암: 10,
      심장질환: 8,
      심혈관질환: 8,
      뇌졸중: 7,
      폐질환: 6,
      간질환: 5,
      신장질환: 5,
      비만: 4,
      고지혈증: 2,
    };

    if (diseases && diseases.length > 0) {
      diseases.forEach((disease) => {
        const deduction = diseaseDeductions[disease] || 2; // 기타 질병은 2년 차감
        baseExpectancy -= deduction;
      });
    }

    // 현재 나이 보정 (70세 이상인 경우)
    if (age && age > 70) {
      baseExpectancy = Math.max(baseExpectancy, age + 10);
    }

    return Math.round(baseExpectancy * 10) / 10;
  }

  /**
   * 활동 타입 이름 반환
   */
  private getActivityTypeName(type: string): string {
    const typeNames: { [key: string]: string } = {
      detailed_view: "상세분석 보기",
      medicine_analysis: "약물 상호작용 분석",
      recommendation_view: "오늘의 추천 보기",
      food_analysis: "음식 분석",
    };
    return typeNames[type] || type;
  }

  /**
   * 활동 로그 기록 (보너스 포인트 포함)
   */
  async logActivity(
    userId: string,
    activityType: string,
    referenceId?: string,
    referenceName?: string,
    lifeChangeDays?: number
  ) {
    const client = this.supabaseService.getClient();

    // 활동별 기본 보너스 설정
    const defaultBonuses: { [key: string]: number } = {
      detailed_view: 20,
      medicine_analysis: 20,
      recommendation_view: 10,
    };

    const bonus = lifeChangeDays ?? defaultBonuses[activityType] ?? 0;

    const { data, error } = await client
      .from("activity_logs")
      .insert({
        user_id: userId,
        activity_type: activityType,
        reference_id: referenceId || null,
        reference_name: referenceName || null,
        life_change_days: bonus,
      })
      .select()
      .single();

    if (error) {
      console.error("[StatsService] Failed to log activity:", error);
      throw error;
    }

    return data;
  }

  /**
   * 전체 요약 통계
   */
  async getSummary(userId: string) {
    const client = this.supabaseService.getClient();

    // 최근 30일 평균 점수
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: recentScores } = await client
      .from("daily_scores")
      .select("*")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgoStr);

    const avgScore30Days =
      recentScores && recentScores.length > 0
        ? recentScores.reduce((sum, d) => {
            const dayAvg =
              ((d.food_total_score || 0) +
                (d.combined_count || 0) * (d.combined_avg_score || 0)) /
              ((d.food_count || 0) + (d.combined_count || 0) || 1);
            return sum + dayAvg;
          }, 0) / recentScores.length
        : 0;

    // 전체 기록 수
    const { count: totalFoodRecords } = await client
      .from("food_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: totalCombinedRecords } = await client
      .from("combined_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    return {
      totalRecords: (totalFoodRecords || 0) + (totalCombinedRecords || 0),
      avgScore30Days: Math.round(avgScore30Days),
      recentDays: recentScores?.length || 0,
    };
  }
}
