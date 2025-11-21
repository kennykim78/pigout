/**
 * 질병별 음식 평가 규칙 엔진
 */

export interface DiseaseRule {
  name: string;
  riskFactors: {
    nutrient: string;
    threshold: number;
    severity: 'high' | 'medium' | 'low';
  }[];
  foodTypeRisks: {
    type: string;
    penalty: number;
  }[];
}

export const DISEASE_RULES: Record<string, DiseaseRule> = {
  hypertension: {
    name: '고혈압',
    riskFactors: [
      { nutrient: 'sodium', threshold: 500, severity: 'high' },
      { nutrient: 'saturated_fat', threshold: 5, severity: 'medium' },
      { nutrient: 'cholesterol', threshold: 100, severity: 'medium' },
    ],
    foodTypeRisks: [
      { type: '국물', penalty: 15 },
      { type: '찌개', penalty: 15 },
      { type: '탕', penalty: 15 },
      { type: '라면', penalty: 20 },
      { type: '짜장면', penalty: 18 },
      { type: '짬뽕', penalty: 20 },
      { type: '김치', penalty: 12 },
      { type: '젓갈', penalty: 25 },
    ],
  },
  diabetes: {
    name: '당뇨',
    riskFactors: [
      { nutrient: 'sugar', threshold: 20, severity: 'high' },
      { nutrient: 'carbohydrate', threshold: 60, severity: 'high' },
      { nutrient: 'simple_carbs', threshold: 30, severity: 'high' },
    ],
    foodTypeRisks: [
      { type: '밥', penalty: 10 },
      { type: '면', penalty: 12 },
      { type: '빵', penalty: 15 },
      { type: '과자', penalty: 20 },
      { type: '케이크', penalty: 25 },
      { type: '아이스크림', penalty: 22 },
      { type: '주스', penalty: 18 },
      { type: '탄산음료', penalty: 20 },
      { type: '떡', penalty: 15 },
      { type: '피자', penalty: 18 },
    ],
  },
  hyperlipidemia: {
    name: '고지혈증',
    riskFactors: [
      { nutrient: 'saturated_fat', threshold: 7, severity: 'high' },
      { nutrient: 'trans_fat', threshold: 2, severity: 'high' },
      { nutrient: 'cholesterol', threshold: 150, severity: 'high' },
      { nutrient: 'total_fat', threshold: 15, severity: 'medium' },
    ],
    foodTypeRisks: [
      { type: '튀김', penalty: 25 },
      { type: '삼겹살', penalty: 22 },
      { type: '갈비', penalty: 20 },
      { type: '치킨', penalty: 23 },
      { type: '햄버거', penalty: 20 },
      { type: '피자', penalty: 18 },
      { type: '마요네즈', penalty: 15 },
      { type: '버터', penalty: 20 },
      { type: '크림', penalty: 18 },
    ],
  },
};

/**
 * 음식명에서 위험 유형 감지
 */
export function detectFoodTypeRisks(
  foodName: string,
  diseases: string[],
): number {
  let totalPenalty = 0;

  diseases.forEach((disease) => {
    const rule = DISEASE_RULES[disease];
    if (!rule) return;

    rule.foodTypeRisks.forEach((risk) => {
      if (foodName.includes(risk.type)) {
        totalPenalty += risk.penalty;
      }
    });
  });

  return totalPenalty;
}

/**
 * 영양소 기반 위험도 평가
 */
export function evaluateNutritionRisks(
  nutritionData: any,
  diseases: string[],
): number {
  let totalPenalty = 0;

  diseases.forEach((disease) => {
    const rule = DISEASE_RULES[disease];
    if (!rule) return;

    rule.riskFactors.forEach((factor) => {
      const value = nutritionData[factor.nutrient] || 0;

      if (value > factor.threshold) {
        const excessRatio = value / factor.threshold;
        let penalty = 0;

        if (factor.severity === 'high') {
          penalty = Math.min(30, excessRatio * 15);
        } else if (factor.severity === 'medium') {
          penalty = Math.min(20, excessRatio * 10);
        } else {
          penalty = Math.min(10, excessRatio * 5);
        }

        totalPenalty += penalty;
      }
    });
  });

  return Math.min(totalPenalty, 60); // 최대 60점 감점
}

/**
 * 질병 수에 따른 기본 점수 조정
 */
export function getBasePenaltyByDiseaseCount(diseaseCount: number): number {
  if (diseaseCount === 1) return 5;
  if (diseaseCount === 2) return 10;
  if (diseaseCount >= 3) return 15;
  return 0;
}
