/**
 * 공공데이터 API 사용량 모니터링 서비스
 * - 일일 사용량 추적
 * - 사용량 소진 시 AI 대체 활성화
 * - 경고 알림
 */

interface ApiUsageRecord {
  count: number;
  lastReset: string; // YYYY-MM-DD 형식
}

interface ApiUsageStats {
  eDrugApi: ApiUsageRecord;
  recipeApi: ApiUsageRecord;
  nutritionApi: ApiUsageRecord;
  healthFoodApi: ApiUsageRecord;
}

// 메모리 기반 사용량 추적 (서버 재시작 시 리셋)
// 프로덕션에서는 Redis 또는 DB 사용 권장
let apiUsageStats: ApiUsageStats = {
  eDrugApi: { count: 0, lastReset: new Date().toISOString().split('T')[0] },
  recipeApi: { count: 0, lastReset: new Date().toISOString().split('T')[0] },
  nutritionApi: { count: 0, lastReset: new Date().toISOString().split('T')[0] },
  healthFoodApi: { count: 0, lastReset: new Date().toISOString().split('T')[0] },
};

// 일일 한도 설정 (10,000건 기준, 여유분 500건)
const API_DAILY_LIMITS = {
  eDrugApi: 9500,       // e약은요 API
  recipeApi: 9500,      // 레시피 API
  nutritionApi: 9500,   // 식품영양성분 API
  healthFoodApi: 9500,  // 건강기능식품 API
};

/**
 * 날짜가 변경되었으면 카운터 리셋
 */
function checkAndResetDaily(apiName: keyof ApiUsageStats): void {
  const today = new Date().toISOString().split('T')[0];
  if (apiUsageStats[apiName].lastReset !== today) {
    console.log(`[API모니터] ${apiName} 일일 카운터 리셋 (${apiUsageStats[apiName].count} → 0)`);
    apiUsageStats[apiName] = { count: 0, lastReset: today };
  }
}

/**
 * API 호출 전 사용 가능 여부 확인
 * @returns true면 API 호출 가능, false면 AI 대체 필요
 */
export function canUseApi(apiName: keyof ApiUsageStats): boolean {
  checkAndResetDaily(apiName);
  const limit = API_DAILY_LIMITS[apiName];
  const current = apiUsageStats[apiName].count;
  
  if (current >= limit) {
    console.warn(`[API모니터] ⚠️ ${apiName} 일일 한도 도달 (${current}/${limit}) - AI 대체 활성화`);
    return false;
  }
  
  // 80% 도달 시 경고
  if (current >= limit * 0.8) {
    console.warn(`[API모니터] ⚠️ ${apiName} 사용량 80% 초과 (${current}/${limit})`);
  }
  
  return true;
}

/**
 * API 호출 성공 시 카운터 증가
 */
export function recordApiUsage(apiName: keyof ApiUsageStats, count: number = 1): void {
  checkAndResetDaily(apiName);
  apiUsageStats[apiName].count += count;
  
  const limit = API_DAILY_LIMITS[apiName];
  const current = apiUsageStats[apiName].count;
  
  console.log(`[API모니터] ${apiName}: ${current}/${limit} (${Math.round(current/limit*100)}%)`);
}

/**
 * 현재 API 사용량 조회
 */
export function getApiUsageStats(): ApiUsageStats & { limits: typeof API_DAILY_LIMITS } {
  // 모든 API 날짜 체크
  Object.keys(apiUsageStats).forEach(key => {
    checkAndResetDaily(key as keyof ApiUsageStats);
  });
  
  return {
    ...apiUsageStats,
    limits: API_DAILY_LIMITS,
  };
}

/**
 * 사용량 수동 리셋 (테스트용)
 */
export function resetApiUsage(apiName?: keyof ApiUsageStats): void {
  const today = new Date().toISOString().split('T')[0];
  
  if (apiName) {
    apiUsageStats[apiName] = { count: 0, lastReset: today };
    console.log(`[API모니터] ${apiName} 수동 리셋 완료`);
  } else {
    apiUsageStats = {
      eDrugApi: { count: 0, lastReset: today },
      recipeApi: { count: 0, lastReset: today },
      nutritionApi: { count: 0, lastReset: today },
      healthFoodApi: { count: 0, lastReset: today },
    };
    console.log(`[API모니터] 전체 API 카운터 리셋 완료`);
  }
}
