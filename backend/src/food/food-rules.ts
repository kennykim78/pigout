/**
 * 계층적 분석을 위한 규칙 기반 음식 데이터
 * 일반적인 음식은 AI 호출 없이 규칙으로 처리
 */

// 안전한 일반 음식 (대부분의 질병에서 안전)
export const SAFE_FOODS: Record<string, {
  score: number;
  summary: string;
  pros: string;
  cons: string;
  expertAdvice: string;
}> = {
  '물': {
    score: 95,
    summary: '물은 모든 사람에게 필수적인 음료입니다.',
    pros: '수분 보충, 신진대사 촉진, 독소 배출에 도움',
    cons: '과도한 섭취 시 전해질 불균형 가능',
    expertAdvice: '하루 8잔(2L) 정도의 물을 규칙적으로 섭취하세요.',
  },
  '밥': {
    score: 75,
    summary: '쌀밥은 한국인의 주식으로 탄수화물의 좋은 공급원입니다.',
    pros: '에너지 공급, 소화가 잘 됨, 포만감 제공',
    cons: '당뇨 환자는 혈당 상승에 주의 필요',
    expertAdvice: '잡곡밥으로 대체하면 영양가가 높아집니다.',
  },
  '현미밥': {
    score: 85,
    summary: '현미밥은 백미보다 영양가가 높은 건강한 주식입니다.',
    pros: '식이섬유 풍부, 혈당 상승 완만, 비타민B군 함유',
    cons: '소화력이 약한 분은 주의',
    expertAdvice: '처음엔 백미와 섞어 드시다가 점차 비율을 높이세요.',
  },
  '사과': {
    score: 85,
    summary: '사과는 식이섬유와 항산화 성분이 풍부한 과일입니다.',
    pros: '펙틴(식이섬유) 풍부, 비타민C, 항산화 효과',
    cons: '당뇨 환자는 과당 섭취량 고려 필요',
    expertAdvice: '껍질째 먹으면 영양소를 더 섭취할 수 있습니다.',
  },
  '바나나': {
    score: 80,
    summary: '바나나는 칼륨이 풍부하고 에너지 보충에 좋은 과일입니다.',
    pros: '칼륨 풍부, 빠른 에너지 공급, 소화 촉진',
    cons: '신장 질환 환자는 칼륨 섭취 주의, 당뇨 환자 주의',
    expertAdvice: '운동 전후 간식으로 적합합니다.',
  },
  '두부': {
    score: 90,
    summary: '두부는 식물성 단백질의 훌륭한 공급원입니다.',
    pros: '고단백 저칼로리, 이소플라본 함유, 콜레스테롤 없음',
    cons: '통풍 환자는 과다 섭취 주의 (퓨린)',
    expertAdvice: '다양한 조리법으로 활용하세요.',
  },
  '계란': {
    score: 80,
    summary: '계란은 완전식품으로 불리는 영양가 높은 식품입니다.',
    pros: '양질의 단백질, 비타민D, 콜린 함유',
    cons: '콜레스테롤 민감한 분은 노른자 섭취량 조절',
    expertAdvice: '하루 1-2개 정도가 적당합니다.',
  },
  '닭가슴살': {
    score: 88,
    summary: '닭가슴살은 고단백 저지방 식품의 대표입니다.',
    pros: '고단백 저지방, 다이어트에 적합, 근육 형성 도움',
    cons: '퓨린 함량으로 통풍 환자 주의',
    expertAdvice: '굽거나 삶아서 드시는 것이 좋습니다.',
  },
  '브로콜리': {
    score: 92,
    summary: '브로콜리는 영양소가 풍부한 슈퍼푸드입니다.',
    pros: '비타민C·K 풍부, 항암 성분, 식이섬유',
    cons: '갑상선 기능 저하증 환자는 과다 섭취 주의',
    expertAdvice: '살짝 데쳐서 드시면 영양소 파괴를 줄일 수 있습니다.',
  },
  '시금치': {
    score: 88,
    summary: '시금치는 철분과 비타민이 풍부한 녹색 채소입니다.',
    pros: '철분, 엽산, 비타민A·C·K 풍부',
    cons: '신장결석 환자는 옥살산 주의, 와파린 복용자 주의',
    expertAdvice: '데쳐서 나물로 드시거나 샐러드로 활용하세요.',
  },
  '양배추': {
    score: 85,
    summary: '양배추는 위 건강에 좋은 채소입니다.',
    pros: '비타민U 함유(위 점막 보호), 식이섬유, 저칼로리',
    cons: '갑상선 기능 저하증 환자는 과다 섭취 주의',
    expertAdvice: '생으로 먹거나 살짝 익혀 드세요.',
  },
  '당근': {
    score: 85,
    summary: '당근은 베타카로틴이 풍부한 채소입니다.',
    pros: '베타카로틴(비타민A), 눈 건강, 항산화 효과',
    cons: '과다 섭취 시 피부 황변 가능',
    expertAdvice: '기름과 함께 조리하면 흡수율이 높아집니다.',
  },
  '토마토': {
    score: 87,
    summary: '토마토는 리코펜이 풍부한 건강 식품입니다.',
    pros: '리코펜(항산화), 비타민C, 저칼로리',
    cons: '위산 역류 환자는 주의',
    expertAdvice: '익혀 먹으면 리코펜 흡수율이 높아집니다.',
  },
  '오이': {
    score: 82,
    summary: '오이는 수분이 많고 저칼로리인 채소입니다.',
    pros: '수분 보충, 저칼로리, 칼륨 함유',
    cons: '특별한 주의사항 없음',
    expertAdvice: '여름철 수분 보충에 좋습니다.',
  },
  '고구마': {
    score: 80,
    summary: '고구마는 식이섬유와 베타카로틴이 풍부합니다.',
    pros: '식이섬유 풍부, 베타카로틴, 포만감',
    cons: '당뇨 환자는 섭취량 조절 필요',
    expertAdvice: '찌거나 구워서 드시면 좋습니다.',
  },
  '감자': {
    score: 72,
    summary: '감자는 탄수화물과 칼륨이 풍부한 식품입니다.',
    pros: '칼륨 풍부, 비타민C, 포만감',
    cons: '당뇨 환자는 혈당 상승 주의, 튀기면 칼로리 증가',
    expertAdvice: '삶거나 쪄서 드시는 것이 좋습니다.',
  },
  '우유': {
    score: 78,
    summary: '우유는 칼슘과 단백질의 좋은 공급원입니다.',
    pros: '칼슘, 단백질, 비타민D 강화',
    cons: '유당불내증 환자 주의, 포화지방 함유',
    expertAdvice: '저지방 우유를 선택하면 좋습니다.',
  },
  '요거트': {
    score: 82,
    summary: '요거트는 프로바이오틱스가 풍부한 유제품입니다.',
    pros: '프로바이오틱스(장 건강), 칼슘, 단백질',
    cons: '당분 첨가 제품은 당 섭취 주의',
    expertAdvice: '무가당 플레인 요거트가 가장 좋습니다.',
  },
  '견과류': {
    score: 85,
    summary: '견과류는 건강한 지방과 영양소가 풍부합니다.',
    pros: '불포화지방산, 비타민E, 마그네슘',
    cons: '칼로리가 높아 과다 섭취 주의',
    expertAdvice: '하루 한 줌(약 30g) 정도가 적당합니다.',
  },
  '아몬드': {
    score: 85,
    summary: '아몬드는 비타민E가 풍부한 견과류입니다.',
    pros: '비타민E, 불포화지방산, 식이섬유',
    cons: '칼로리가 높아 과다 섭취 주의',
    expertAdvice: '하루 20-25알 정도가 적당합니다.',
  },
  '호두': {
    score: 85,
    summary: '호두는 오메가3가 풍부한 견과류입니다.',
    pros: '오메가3 지방산, 뇌 건강, 항산화',
    cons: '칼로리가 높아 과다 섭취 주의',
    expertAdvice: '하루 5-7알 정도가 적당합니다.',
  },
  '녹차': {
    score: 82,
    summary: '녹차는 카테킨이 풍부한 건강 음료입니다.',
    pros: '카테킨(항산화), 카페인(각성), 대사 촉진',
    cons: '카페인 민감자 주의, 빈속에 마시면 위장 자극',
    expertAdvice: '식후에 마시는 것이 좋습니다.',
  },
};

// 질병별 주의 음식
export const DISEASE_CAUTIONS: Record<string, {
  foods: string[];
  reason: string;
  scoreModifier: number; // 점수 조정값
}> = {
  '당뇨': {
    foods: ['밥', '감자', '바나나', '고구마', '사과'],
    reason: '혈당 상승 가능성이 있어 섭취량 조절이 필요합니다.',
    scoreModifier: -15,
  },
  '고혈압': {
    foods: [],
    reason: '나트륨 함량이 높은 음식은 주의가 필요합니다.',
    scoreModifier: 0,
  },
  '신장질환': {
    foods: ['바나나', '시금치', '감자', '견과류', '아몬드', '호두'],
    reason: '칼륨 함량이 높아 신장 기능에 부담을 줄 수 있습니다.',
    scoreModifier: -20,
  },
  '통풍': {
    foods: ['두부', '닭가슴살'],
    reason: '퓨린 함량으로 인해 요산 수치가 상승할 수 있습니다.',
    scoreModifier: -10,
  },
  '갑상선질환': {
    foods: ['브로콜리', '양배추'],
    reason: '갑상선 호르몬 합성에 영향을 줄 수 있습니다.',
    scoreModifier: -10,
  },
};

// 약물 상호작용 주의 음식
export const DRUG_FOOD_INTERACTIONS: Record<string, {
  foods: string[];
  reason: string;
  scoreModifier: number;
}> = {
  '와파린': {
    foods: ['시금치', '브로콜리', '양배추', '녹차'],
    reason: '비타민K가 풍부하여 와파린의 효과를 감소시킬 수 있습니다.',
    scoreModifier: -25,
  },
  '혈압약': {
    foods: ['바나나', '감자'],
    reason: '칼륨 수치에 영향을 줄 수 있습니다.',
    scoreModifier: -10,
  },
};

/**
 * 규칙 기반 분석 가능 여부 확인
 */
export function canUseRuleBasedAnalysis(foodName: string): boolean {
  const normalizedName = foodName.trim().toLowerCase();
  
  // 정확히 일치하거나, 포함하는 경우
  for (const key of Object.keys(SAFE_FOODS)) {
    if (normalizedName === key || normalizedName.includes(key)) {
      return true;
    }
  }
  return false;
}

/**
 * 규칙 기반 분석 수행
 */
export function getRuleBasedAnalysis(
  foodName: string,
  diseases: string[],
  medicines: string[]
): {
  score: number;
  analysis: string;
  detailedAnalysis: any;
  dataSource: string;
} | null {
  const normalizedName = foodName.trim().toLowerCase();
  
  // 음식 찾기
  let foodData = null;
  let matchedKey = '';
  for (const [key, data] of Object.entries(SAFE_FOODS)) {
    if (normalizedName === key || normalizedName.includes(key)) {
      foodData = data;
      matchedKey = key;
      break;
    }
  }
  
  if (!foodData) return null;
  
  let finalScore = foodData.score;
  const warnings: string[] = [];
  
  // 질병별 점수 조정
  for (const disease of diseases) {
    const caution = DISEASE_CAUTIONS[disease];
    if (caution && caution.foods.includes(matchedKey)) {
      finalScore += caution.scoreModifier;
      warnings.push(`${disease}: ${caution.reason}`);
    }
  }
  
  // 약물 상호작용 점수 조정
  for (const medicine of medicines) {
    for (const [drug, interaction] of Object.entries(DRUG_FOOD_INTERACTIONS)) {
      if (medicine.includes(drug) && interaction.foods.includes(matchedKey)) {
        finalScore += interaction.scoreModifier;
        warnings.push(`${medicine}: ${interaction.reason}`);
      }
    }
  }
  
  // 점수 범위 제한
  finalScore = Math.max(10, Math.min(100, finalScore));
  
  const analysis = warnings.length > 0
    ? `${foodData.summary}\n⚠️ 주의: ${warnings.join(' / ')}`
    : foodData.summary;
  
  return {
    score: finalScore,
    analysis,
    detailedAnalysis: {
      pros: foodData.pros,
      cons: foodData.cons + (warnings.length > 0 ? ` | ${warnings.join(', ')}` : ''),
      summary: foodData.summary,
      warnings: warnings.join('\n') || '',
      expertAdvice: foodData.expertAdvice,
      dataSources: ['규칙 기반 분석 (AI 미사용)'],
      mode: 'rule-based',
    },
    dataSource: 'rule-based',
  };
}
