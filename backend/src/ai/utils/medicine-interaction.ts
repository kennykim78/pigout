/**
 * 약물-음식 상호작용 분석 유틸리티
 */

export interface MedicineInfo {
  id: string;
  name: string;
  ingredients: string[];
  foodInteractions: string[];
}

export interface InteractionRisk {
  medicine: string;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  description: string;
}

export class MedicineInteractionAnalyzer {
  /**
   * 약물-음식 상호작용 기본 룰 기반 분석
   */
  static analyzeBasicInteractions(
    medicines: MedicineInfo[],
    foodName: string,
  ): InteractionRisk[] {
    const risks: InteractionRisk[] = [];

    for (const medicine of medicines) {
      // 음식 상호작용 체크
      if (medicine.foodInteractions && medicine.foodInteractions.length > 0) {
        for (const interactionFood of medicine.foodInteractions) {
          if (
            foodName.includes(interactionFood) ||
            interactionFood.includes(foodName)
          ) {
            risks.push({
              medicine: medicine.name,
              riskLevel: this.determineRiskLevel(interactionFood, foodName),
              description: `${medicine.name}은(는) ${interactionFood}와(과) 상호작용할 수 있습니다.`,
            });
          }
        }
      }

      // 특정 성분 기반 상호작용 (공통 룰)
      const commonRisks = this.checkCommonInteractions(medicine, foodName);
      risks.push(...commonRisks);
    }

    return risks;
  }

  /**
   * 일반적인 약물-음식 상호작용 체크
   */
  private static checkCommonInteractions(
    medicine: MedicineInfo,
    foodName: string,
  ): InteractionRisk[] {
    const risks: InteractionRisk[] = [];

    // 알코올 상호작용
    if (foodName.includes('술') || foodName.includes('알코올') || foodName.includes('소주')) {
      risks.push({
        medicine: medicine.name,
        riskLevel: 'danger',
        description: `${medicine.name} 복용 중에는 알코올 섭취를 피해야 합니다.`,
      });
    }

    // 자몽 상호작용 (많은 약물과 상호작용)
    if (foodName.includes('자몽')) {
      if (
        medicine.ingredients.some(
          (ing) =>
            ing.includes('암로디핀') ||
            ing.includes('심바스타틴') ||
            ing.includes('펠로디핀'),
        )
      ) {
        risks.push({
          medicine: medicine.name,
          riskLevel: 'warning',
          description: `${medicine.name}은(는) 자몽과 상호작용하여 약물 농도를 높일 수 있습니다.`,
        });
      }
    }

    // 카페인 상호작용
    if (
      foodName.includes('커피') ||
      foodName.includes('카페인') ||
      foodName.includes('녹차')
    ) {
      if (medicine.ingredients.some((ing) => ing.includes('아스피린'))) {
        risks.push({
          medicine: medicine.name,
          riskLevel: 'caution',
          description: `${medicine.name}과 카페인 섭취를 함께하면 위장 자극이 증가할 수 있습니다.`,
        });
      }
    }

    // 고칼륨 음식 (ACE 억제제, ARB 등과 상호작용)
    if (
      foodName.includes('바나나') ||
      foodName.includes('아보카도') ||
      foodName.includes('시금치')
    ) {
      if (
        medicine.ingredients.some(
          (ing) => ing.includes('로사르탄') || ing.includes('에날라프릴'),
        )
      ) {
        risks.push({
          medicine: medicine.name,
          riskLevel: 'caution',
          description: `${medicine.name} 복용 중 고칼륨 음식 과다 섭취 시 주의가 필요합니다.`,
        });
      }
    }

    return risks;
  }

  /**
   * 위험도 결정
   */
  private static determineRiskLevel(
    interactionFood: string,
    foodName: string,
  ): 'safe' | 'caution' | 'warning' | 'danger' {
    if (interactionFood.includes('알코올') || interactionFood.includes('술')) {
      return 'danger';
    }
    if (interactionFood.includes('자몽')) {
      return 'warning';
    }
    return 'caution';
  }
}
