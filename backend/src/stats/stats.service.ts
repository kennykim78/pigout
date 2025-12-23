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
   * 1. 최근 1주일 수명 변화
   * 2. 초기 기대수명 + 오늘 변화량
   * 3. 오늘 먹은 음식 타임라인 (아침/점심/저녁/간식)
   * 4. 월별 히스토리
   */
  async getMyStatus(userId: string) {
    const client = this.supabaseService.getClient();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // 1주일 전 날짜 계산
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

    // 3개월 전 날짜 계산
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

    // 1. 전체 누적 수명 계산
    const { data: allScores, error: scoreError } = await client
      .from("food_records")
      .select("score")
      .eq("user_id", userId);

    if (scoreError) throw scoreError;

    let totalLifeChangeHours = 0;
    if (allScores) {
      totalLifeChangeHours = allScores.reduce((acc, curr) => {
        const change = (curr.score - 70) * 0.1;
        return acc + change;
      }, 0);
    }

    // 2. 최근 1주일 수명 변화 계산
    const { data: weeklyScores, error: weeklyError } = await client
      .from("food_records")
      .select("score")
      .eq("user_id", userId)
      .gte("created_at", `${oneWeekAgoStr}T00:00:00`)
      .lte("created_at", `${todayStr}T23:59:59`);

    if (weeklyError) throw weeklyError;

    let weeklyLifeChangeHours = 0;
    if (weeklyScores) {
      weeklyLifeChangeHours = weeklyScores.reduce((acc, curr) => {
        const change = (curr.score - 70) * 0.1;
        return acc + change;
      }, 0);
    }

    // 3. 오늘의 기록 조회 (Timeline용)
    const { data: todayRecords, error: recordError } = await client
      .from("food_records")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", `${todayStr}T00:00:00`)
      .lt("created_at", `${todayStr}T23:59:59`)
      .order("created_at", { ascending: true });

    if (recordError) throw recordError;

    // 시간대별 분류
    const timeline = {
      morning: [],
      lunch: [],
      dinner: [],
      snack: [],
    };

    let todayLifeChangeHours = 0;

    (todayRecords || []).forEach((record) => {
      const date = new Date(record.created_at);
      const hour = date.getHours();
      let period = "snack";

      if (hour >= 5 && hour < 11) period = "morning";
      else if (hour >= 11 && hour < 16) period = "lunch";
      else if (hour >= 16 && hour < 22) period = "dinner";
      else period = "snack";

      const safeScore = record.score || 70;
      const lifeChange = (safeScore - 70) * 0.1;
      todayLifeChangeHours += lifeChange;

      timeline[period].push({
        id: record.id,
        foodName: record.food_name,
        score: safeScore,
        time: date.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        lifeChange: lifeChange,
        imageUrl: record.image_path,
      });
    });

    // 4. 월별 히스토리 조회 (최근 3개월)
    const { data: historyRecords, error: historyError } = await client
      .from("food_records")
      .select("id, food_name, score, created_at, image_path")
      .eq("user_id", userId)
      .gte("created_at", `${threeMonthsAgoStr}T00:00:00`)
      .order("created_at", { ascending: false });

    if (historyError) throw historyError;

    // 월별/일별로 그룹화
    const monthlyHistory = {};
    (historyRecords || []).forEach((record) => {
      const date = new Date(record.created_at);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const dayKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (!monthlyHistory[monthKey]) {
        monthlyHistory[monthKey] = {
          month: monthKey,
          days: {},
          totalLifeChange: 0,
          recordCount: 0,
        };
      }

      if (!monthlyHistory[monthKey].days[dayKey]) {
        monthlyHistory[monthKey].days[dayKey] = {
          date: dayKey,
          records: [],
          dailyLifeChange: 0,
        };
      }

      const safeScore = record.score || 70;
      const lifeChange = (safeScore - 70) * 0.1;

      monthlyHistory[monthKey].days[dayKey].records.push({
        id: record.id,
        foodName: record.food_name,
        score: safeScore,
        lifeChange: lifeChange,
        time: date.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        imageUrl: record.image_path,
      });

      monthlyHistory[monthKey].days[dayKey].dailyLifeChange += lifeChange;
      monthlyHistory[monthKey].totalLifeChange += lifeChange;
      monthlyHistory[monthKey].recordCount++;
    });

    // 초기 기대수명 (기본값: 80년, 추후 프로필 기반 계산 가능)
    const initialLifeExpectancy = 80;

    return {
      weeklyLifeChangeHours: Number(weeklyLifeChangeHours.toFixed(1)),
      totalLifeChangeHours: Number(totalLifeChangeHours.toFixed(1)),
      todayLifeChangeHours: Number(todayLifeChangeHours.toFixed(1)),
      initialLifeExpectancy,
      timeline,
      monthlyHistory,
    };
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
