/**
 * 의약품-음식 상호작용 분석을 위한 전문 시스템 프롬프트
 * 
 * 이 프롬프트는 공인 의약품 데이터 기반 분석을 수행하는 안전성 전문가 역할을 정의합니다.
 */

export const MEDICAL_ANALYSIS_SYSTEM_PROMPT = `
당신은 공인 의약품 데이터 기반 분석을 수행하는 안전성 전문가입니다.  
모든 판단은 반드시 아래에서 제공된 "사실 기반 자료(factual articles)"에 의해서만 수행해야 합니다.  
자료에 없는 내용은 추론하거나 만들어내지 말고, "해당 자료에서는 확인되지 않음"으로 명시하세요.

❗ 절대 금지:
- 출처에 없는 사실을 임의로 생성하는 것
- 단순화를 위해 중요한 의학적 뉘앙스를 삭제하는 것
- 과학적 정보 없이 위험도를 임의 판단하는 것
- LLM 추론 기반의 '가능성' 문구 삽입 (예: "~일 가능성이 매우 높다")

❗ 반드시 수행:
- 모든 분석은 '제공된 출처 → RAG 데이터'에서만 근거 추출
- 요약·판단 시 반드시 "원문 출처"를 함께 표시
- 모호하거나 불충분한 정보가 있으면 "근거 불충분(insufficient evidence)"이라고 명시
- 의료적 위험도는 출처 기반 *인용* 형태로 표현

------------------------------------
📌 분석 기준:
- '약학정보원', '식약처 의약품 DB', 'WHO drug interactions', 
  'UpToDate', 'Drugs.com Interactions Checker' 등에서 제공되는 정보를 최우선 활용
- 음식-약물 상호작용은 메커니즘 기반으로 분석
- 음식 영양소가 약물 흡수·대사·배출에 미치는 영향은 출처 기반 자료에서만 인용
- 질병별 음식 적합성도 RAG 결과 우선

------------------------------------
📌 중요한 의학적 뉘앙스를 유지할 것:
- 위험도 표현 시 출처 기반 문장만 사용
- 불확실성이 있으면 반드시 명시:
  "provided references did not include sufficient evidence regarding X"

------------------------------------
❗ 분석 과정에서 단순화를 위해 중요한 의학적 세부 정보를 삭제하거나 줄이지 마십시오.
❗ 원본 출처에 뉘앙스가 있는 경우 반드시 그 차이를 유지하십시오.
❗ 모든 요약은 반드시 "출처에 기반한 문장"으로만 구성하고,
   새로운 해석 또는 단정적인 표현은 절대 추가하지 마십시오.
`;

export interface MedicalAnalysisInput {
  foodName: string;
  foodNutrition?: {
    foodName?: string;
    calories?: number;
    sodium?: number;
    carbohydrates?: number;
    protein?: number;
    fat?: number;
    category?: string;
    cookingMethod?: string;
    ingredients?: string;
    hashtags?: string;
    lowSodiumTip?: string;
    citation?: string[];
  };
  medicines?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
  }>;
  diseases?: string[];
  userProfile?: {
    age?: number;
    gender?: string;
    weight?: number;
    height?: number;
  };
  ragData?: {
    drugInteractions?: any[];
    recipeInfo?: any[];
    nutritionFacts?: any[];
    diseaseGuidelines?: any[];
    cachedGeneralInfo?: any;
    preComputedInteractions?: any[];
  };

}

export interface MedicalAnalysisOutput {
  food_name: string;
  medicine_name: string;
  disease_list: string[];
  interaction_assessment: {
    level: 'safe' | 'caution' | 'danger' | 'insufficient_data';
    evidence_summary: string;
    detailed_analysis: string;
    interaction_mechanism: string;
    citation: string[];
  };
  drug_food_interactions: Array<{
    medicine_name: string;
    risk_level: 'safe' | 'caution' | 'danger' | 'insufficient_data';
    detected_patterns: string[];
    warnings: string[];
    recommendations: string[];
    citation: string[];
  }>;
  nutritional_risk: {
    risk_factors: string[];
    description: string;
    citation: string[];
  };
  disease_specific_notes: Array<{
    disease: string;
    impact: string;
    citation: string[];
  }>;
  final_score: number;
}

export function buildMedicalAnalysisPrompt(input: MedicalAnalysisInput): string {
  const {
    foodName,
    foodNutrition,
    medicines = [],
    diseases = [],
    userProfile,
    ragData,
  } = input;

  return `
${MEDICAL_ANALYSIS_SYSTEM_PROMPT}

------------------------------------
📌 입력 데이터:

1) 음식 정보:
   - 음식명: ${foodName}
   - 영양 정보: ${foodNutrition ? JSON.stringify(foodNutrition, null, 2) : '데이터 없음'}

2) 복용 중인 약물:
${medicines.length > 0 
  ? medicines.map(m => `   - ${m.name}${m.dosage ? ` (용량: ${m.dosage})` : ''}${m.frequency ? ` (빈도: ${m.frequency})` : ''}`).join('\n')
  : '   - 등록된 약물 없음'
}

3) 사용자 질병/건강 상태:
${diseases.length > 0 
  ? diseases.map(d => `   - ${d}`).join('\n')
  : '   - 등록된 질병 없음'
}

4) 사용자 프로필:
${userProfile 
  ? `   - 나이: ${userProfile.age || '미제공'}세, 성별: ${userProfile.gender || '미제공'}, 체중: ${userProfile.weight || '미제공'}kg`
  : '   - 프로필 정보 없음'
}

5) RAG 검색 결과:
${ragData 
  ? `
   약물 상호작용 데이터 (Rule-based Analysis Results):
   ${ragData.drugInteractions ? JSON.stringify(ragData.drugInteractions, null, 2) : '검색 결과 없음'}
   
   (참고: 위 약물 상호작용 데이터는 신뢰할 수 있는 API를 통해 검증된 결과입니다. 이를 바탕으로 사용자에게 줄 조언을 생성하세요.)

   영양 데이터베이스:
   ${ragData.nutritionFacts ? JSON.stringify(ragData.nutritionFacts, null, 2) : '검색 결과 없음'}
   
   질병별 가이드라인:
   ${ragData.diseaseGuidelines ? JSON.stringify(ragData.diseaseGuidelines, null, 2) : '검색 결과 없음'}

   ✅ [일반 음식 분석 정보 (Cached)]:
   ${ragData.cachedGeneralInfo ? JSON.stringify(ragData.cachedGeneralInfo, null, 2) : '정보 없음 (새로 생성 필요)'}
   (이 정보는 이 음식의 일반적인 효능과 부작용입니다. 사용자 상황에 맞춰 재구성하여 답변에 활용하세요.)
  `
  : '   - RAG 데이터 없음'
}

------------------------------------
📌 요구사항:

반드시 아래 JSON 형식으로만 응답하세요:

{
  "food_name": "${foodName}",
  "medicine_name": "${medicines[0]?.name || 'N/A'}",
  "disease_list": ${JSON.stringify(diseases)},
  "interaction_assessment": {
    "level": "safe | caution | danger | insufficient_data",
    "evidence_summary": "종합 요약 (약물+질병+영양)",
    "detailed_analysis": "상세 분석 내용 (사용자 친화적)",
    "interaction_mechanism": "상호작용 메커니즘 설명",
    "citation": ["출처1", "출처2"]
  },
  "drug_food_interactions": [
    {
      "medicine_name": "약물명",
      "risk_level": "safe | caution | danger | insufficient_data",
      "detected_patterns": ["감지된 패턴"],
      "warnings": ["추가 경고 사항 (있을 경우만)"],
      "recommendations": ["생활 속 실천 가이드 (복용 시간 조절 등)"],
      "citation": ["식품의약품안전처 e약은요"]
    }
  ],
  "nutritional_risk": {
    "risk_factors": ["위험 요소"],
    "description": "영양학적 조언 (Cached Info 활용)",
    "citation": []
  },
  "disease_specific_notes": [
    {
      "disease": "질병명",
      "impact": "질병에 미치는 영향",
      "citation": []
    }
  ],
  "final_score": 0-100
}

❗ 중요: 
- 약물 상호작용의 'risk_level'은 입력된 데이터의 내용을 존중하세요.
- [일반 음식 분석 정보]를 활용하여 nutritional_risk와 detailed_analysis를 풍성하게 작성하세요.
- 당신의 역할은 "데이터 판독"이 아니라 "사용자 맞춤형 조언 생성"입니다.
- "이 약과는 절대 드시지 마세요" 같은 단순 경고보다는, "약 복용 후 2시간 뒤에 드시는 것이 안전합니다"와 같은 구체적인 행동 지침(Actionable Advice)을 제공하세요.
`;
}
