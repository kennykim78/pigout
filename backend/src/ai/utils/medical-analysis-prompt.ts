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
   약물 상호작용 데이터:
   ${ragData.drugInteractions ? JSON.stringify(ragData.drugInteractions, null, 2) : '검색 결과 없음'}
   
   영양 데이터베이스:
   ${ragData.nutritionFacts ? JSON.stringify(ragData.nutritionFacts, null, 2) : '검색 결과 없음'}
   
   질병별 가이드라인:
   ${ragData.diseaseGuidelines ? JSON.stringify(ragData.diseaseGuidelines, null, 2) : '검색 결과 없음'}
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
    "evidence_summary": "출처 기반 요약",
    "detailed_analysis": "상세 분석 내용",
    "interaction_mechanism": "상호작용 메커니즘 (출처 명시)",
    "citation": ["출처1", "출처2"]
  },
  "nutritional_risk": {
    "risk_factors": ["위험 요소1", "위험 요소2"],
    "description": "출처 기반 설명",
    "citation": ["출처1"]
  },
  "disease_specific_notes": [
    {
      "disease": "질병명",
      "impact": "영향 설명 (출처 기반)",
      "citation": ["출처"]
    }
  ],
  "final_score": 0-100
}

❗ 중요: 
- 모든 분석은 제공된 RAG 데이터와 출처에서만 근거를 추출하세요
- 근거가 부족한 경우 "insufficient evidence"로 명시하세요
- 절대 추론하거나 가정하지 마세요
`;
}
