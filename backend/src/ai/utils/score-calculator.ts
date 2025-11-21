import {
  detectFoodTypeRisks,
  evaluateNutritionRisks,
  getBasePenaltyByDiseaseCount,
} from './rule-engine';

/**
 * 음식 적합도 점수 계산기 (0~100)
 */
export class ScoreCalculator {
  /**
   * 종합 점수 계산
   * @param foodName 음식명
   * @param diseases 질병 목록 (1~3개)
   * @param nutritionData 영양 정보 (선택)
   * @returns 0~100 사이의 점수
   */
  calculateScore(
    foodName: string,
    diseases: string[],
    nutritionData?: any,
  ): number {
    // 기본 점수 100에서 시작
    let score = 100;

    // 1. 질병 개수에 따른 기본 감점
    const basePenalty = getBasePenaltyByDiseaseCount(diseases.length);
    score -= basePenalty;

    // 2. 음식명 기반 위험도 감점
    const foodTypePenalty = detectFoodTypeRisks(foodName, diseases);
    score -= foodTypePenalty;

    // 3. 영양소 기반 위험도 감점 (영양 데이터가 있는 경우)
    if (nutritionData) {
      const nutritionPenalty = evaluateNutritionRisks(nutritionData, diseases);
      score -= nutritionPenalty;
    }

    // 4. 점수 보정 (0~100 범위 유지)
    score = Math.max(0, Math.min(100, score));

    return Math.round(score);
  }

  /**
   * 점수에 따른 등급 반환
   */
  getGrade(score: number): string {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
  }

  /**
   * 점수에 따른 권장사항 레벨
   */
  getRecommendationLevel(score: number): 'safe' | 'caution' | 'avoid' {
    if (score >= 70) return 'safe';
    if (score >= 40) return 'caution';
    return 'avoid';
  }
}
