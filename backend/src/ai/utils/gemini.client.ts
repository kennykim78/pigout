import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

interface GenerateContentCandidatePartText {
  text?: string;
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GenerateContentCandidatePartText[];
    };
  }>;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private visionModel: any;
  private textModel: any;
  private proModel: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Library models (will internally hit v1). Keep for primary path.
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.textModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.proModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  }

  private getBaseUrl(): string {
    // Allow override; default to official v1 endpoint (NOT v1beta)
    return process.env.GEMINI_API_BASE?.trim() || 'https://generativelanguage.googleapis.com/v1';
  }

  private async callV1GenerateContent(model: string, parts: any[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const url = `${this.getBaseUrl()}/models/${model}:generateContent?key=${apiKey}`;
    const body = { contents: [{ parts }] };
    const resp = await axios.post(url, body, { timeout: 30000 });
    const data: GenerateContentResponse = resp.data;
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    return text;
  }

  private extractJsonObject(raw: string): any {
    // Remove markdown code blocks if present
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    // Try to find JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in model response');
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      throw new Error('Failed to parse JSON: ' + (e as Error).message);
    }
  }

  async analyzeImageForFood(imageBase64: string, retries = 2): Promise<{
    isValid: boolean;
    category: 'food' | 'medicine' | 'supplement' | 'invalid';
    itemName: string;
    confidence: number;
    rejectReason?: string;
  }> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const prompt = `당신은 이미지 분석 전문가입니다.
이미지를 보고 다음을 판단하세요:

1. 이미지가 다음 중 하나인지 확인:
   - 음식 (음식, 요리, 식사, 간식 등)
   - 약품 (의약품, 알약, 캡슐, 약봉지 등)
   - 건강보조제 (비타민, 영양제, 보조식품 등)
   - 기타 (위의 카테고리에 해당하지 않는 경우)

2. 해당하는 경우 정확한 이름을 한글로 제공

3. 해당하지 않는 경우 거부 사유 제공

JSON 형식으로만 응답:
{
  "isValid": true/false,
  "category": "food" | "medicine" | "supplement" | "invalid",
  "itemName": "정확한 한글 이름",
  "confidence": 0.0-1.0,
  "rejectReason": "거부 사유 (isValid=false인 경우)"
}

예시:
- 김치찌개 사진 → { "isValid": true, "category": "food", "itemName": "김치찌개", "confidence": 0.95 }
- 타이레놀 약통 → { "isValid": true, "category": "medicine", "itemName": "타이레놀", "confidence": 0.98 }
- 비타민 제품 → { "isValid": true, "category": "supplement", "itemName": "종합비타민", "confidence": 0.90 }
- 자동차 사진 → { "isValid": false, "category": "invalid", "itemName": "", "confidence": 0.0, "rejectReason": "촬영하신 이미지가 음식이나, 약품, 건강보조제가 아닙니다." }`;

        let rawText: string;
        try {
          // Primary: SDK path
          const result = await this.visionModel.generateContent([
            prompt,
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
          ]);
          const response = await result.response;
          rawText = response.text();
        } catch (sdkError) {
          console.log(`Vision SDK 오류, REST API 시도 (${attempt + 1}/${retries + 1}):`, sdkError.message);
          // Fallback: direct v1 REST
          rawText = await this.callV1GenerateContent('gemini-2.5-flash', [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ]);
        }

        const parsed = this.extractJsonObject(rawText);
        return parsed;
      } catch (error) {
        lastError = error;
        console.error(`Gemini 이미지 분석 실패 (시도 ${attempt + 1}/${retries + 1}):`, error.message);
        
        if (attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`${waitTime}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 모든 재시도 실패 시 에러
    throw new Error(`Gemini image analysis failed after ${retries + 1} attempts: ${lastError?.message}`);
  }

  async extractFoodNameFromText(textInput: string): Promise<string> {
    try {
      const prompt = `당신은 음식명 추출 전문가입니다.
사용자가 입력한 텍스트에서 음식명을 추출하세요.

입력: "${textInput}"

요구사항:
1. 정확한 한글 음식명만 추출
2. 여러 음식이 있으면 대표 음식 하나만 선택

JSON 형식으로만 응답:
{ "foodName": "추출된 음식명" }`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.5-flash', [ { text: prompt } ]);
      }
      const parsed = this.extractJsonObject(rawText);
      return parsed.foodName;
    } catch (error) {
      console.error('Gemini text extraction error:', error);
      throw new Error(`Gemini text extraction failed: ${error.message}`);
    }
  }

  async analyzeFoodSuitability(
    foodName: string,
    diseases: string[],
    nutritionData?: any,
    publicData?: any,
  ): Promise<{
    suitabilityScore: number;
    pros: string[];
    cons: string[];
    summary: string;
    cookingTips: string[];
    dataSources: string[];
    riskComponents: {
      alcohol?: boolean;
      highSodium?: boolean;
      highPotassium?: boolean;
      caffeine?: boolean;
      citrus?: boolean;
      dairy?: boolean;
      highFat?: boolean;
      vitaminK?: boolean;
    };
  }> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
        const nutritionInfo = nutritionData
          ? JSON.stringify(nutritionData, null, 2)
          : '영양 정보 없음';
        
        const publicDataInfo = publicData
          ? JSON.stringify(publicData, null, 2)
          : '공공데이터 없음';

        const prompt = `당신은 영양 및 질병 관리 전문가입니다.

음식: ${foodName}
질병: ${diseaseList}
영양정보: ${nutritionInfo}

공공데이터 (식품의약품안전처):
${publicDataInfo}

위의 공공데이터를 참고하여 다음을 상세히 분석하세요:

1. suitabilityScore (0-100): 해당 질병을 가진 사람이 이 음식을 섭취하기에 적합한 정도
   - 공공데이터의 영양성분, 레시피 정보를 기반으로 점수 산정
   - 90-100: 매우 적합 (건강에 도움)
   - 70-89: 적합 (적당량 섭취 권장)
   - 50-69: 보통 (주의하며 섭취)
   - 30-49: 부적합 (제한적 섭취)
   - 0-29: 매우 부적합 (피해야 함)

2. pros (배열): 이 음식의 장점 4~6가지
   - 공공데이터의 영양성분을 구체적으로 언급
   - 질병과의 긍정적 관계 설명
   - 각 항목을 상세하게 작성 (최소 30자 이상)

3. cons (배열): 이 음식의 단점이나 주의사항 4~6가지
   - 공공데이터를 기반으로 한 주의사항
   - 질병과의 부정적 관계 설명
   - 각 항목을 상세하게 작성 (최소 30자 이상)

4. summary (문자열): 종합 평가 2~3줄로 요약

5. cookingTips (배열): 더 건강하게 먹는 조리법 추천 4~6가지
   - 공공데이터의 레시피 정보 활용
   - 질병 관리에 도움되는 조리법 추천
   - 각 조리법을 구체적으로 작성 (최소 25자 이상)

6. dataSources (배열): 참고한 공공데이터 출처 목록
   - 예: ["식품의약품안전처 식품영양성분DB", "식품의약품안전처 조리식품 레시피DB"]

7. riskComponents (객체): 음식에 포함된 주요 위험 성분 분석
   - alcohol: 알코올/술 포함 여부 (true/false)
   - highSodium: 높은 나트륨(소금) 함량 여부 (true/false) - 하루 권장량의 30% 이상 시 true
   - highPotassium: 높은 칼륨 함량 여부 (true/false)
   - caffeine: 카페인 포함 여부 (true/false)
   - citrus: 자몽/감귤류 포함 여부 (true/false)
   - dairy: 유제품(우유/치즈) 포함 여부 (true/false)
   - highFat: 높은 지방 함량 여부 (true/false)
   - vitaminK: 비타민K 풍부 채소 포함 여부 (true/false)
   - 해당 성분이 실제로 포함되어 있을 때만 true, 그 외는 false

JSON 형식으로만 응답:
{
  "suitabilityScore": 75,
  "pros": ["영양성분 기반 장점1...", "질병 관리 장점2...", "..."],
  "cons": ["주의사항1...", "단점2...", "..."],
  "summary": "공공데이터를 종합하면...",
  "cookingTips": ["조리법1 상세 설명...", "조리법2 상세 설명...", "..."],
  "dataSources": ["식품의약품안전처 식품영양성분DB", "식품의약품안전처 조리식품 레시피DB"],
  "riskComponents": {
    "alcohol": false,
    "highSodium": true,
    "highPotassium": false,
    "caffeine": false,
    "citrus": false,
    "dairy": false,
    "highFat": false,
    "vitaminK": false
  }
}`;

        let rawText: string;
        try {
          const result = await this.textModel.generateContent(prompt);
          const response = await result.response;
          rawText = response.text();
        } catch (sdkError) {
          console.log(`SDK 오류, REST API로 재시도 (시도 ${attempt + 1}/${maxRetries + 1})...`);
          rawText = await this.callV1GenerateContent('gemini-2.5-flash', [ { text: prompt } ]);
        }
        return this.extractJsonObject(rawText);
      } catch (error) {
        lastError = error;
        console.error(`Gemini 분석 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`, error.message);
        
        if (attempt < maxRetries) {
          // 재시도 전 대기 (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`${waitTime}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 모든 재시도 실패 시 기본값 반환
    console.warn('Gemini API 호출 실패, 기본 분석 반환');
    return {
      suitabilityScore: 65,
      pros: [
        `${foodName}은(는) 적절히 섭취하면 영양소를 공급할 수 있습니다.`,
        '다양한 식재료와 함께 드시면 영양 균형을 맞출 수 있습니다.'
      ],
      cons: diseases.length > 0 
        ? [
            `${diseases.join(', ')} 질환이 있으시다면 섭취량에 주의가 필요합니다.`,
            '과도한 섭취는 피하시는 것이 좋습니다.'
          ]
        : [
            '과도한 섭취는 피하시는 것이 좋습니다.',
            '균형잡힌 식단의 일부로 섭취하세요.'
          ],
      summary: `${foodName}은(는) 균형있게 섭취하시면 좋습니다.`,
      cookingTips: [
        '신선한 재료를 사용하세요',
        '조리 시 염분과 당분을 적게 사용하세요',
        '채소를 많이 추가하면 더 건강해요'
      ],
      dataSources: [],
      riskComponents: {}
    };
  }

  async generateDetailedAnalysis(
    foodName: string,
    diseases: string[],
    nutritionData?: any,
  ): Promise<{
    detailed_reason: string;
    risk_factors: string[];
    nutrition_explanation: string;
    recommendation: string;
    global_remedies: Array<{ country: string; method: string }>;
  }> {
    try {
      const diseaseList = diseases.join(', ');
      const nutritionInfo = nutritionData
        ? JSON.stringify(nutritionData)
        : '영양 정보 없음';

      const prompt = `당신은 세계적인 영양학 및 질병 관리 전문가입니다.

음식: ${foodName}
질병: ${diseaseList}
영양정보: ${nutritionInfo}

다음 항목을 상세히 분석하여 JSON으로 제공하세요:

1. detailed_reason: 이 음식이 해당 질병에 적합한지 부적합한지 상세한 이유 (200자 이상)
2. risk_factors: 주의해야 할 위험 요소 배열 (3~5개)
3. nutrition_explanation: 영양 성분별 설명 (150자 이상)
4. recommendation: 섭취 권장사항 (100자 이상)
5. global_remedies: 한국, 중국, 인도, 미국 4개국의 전통/현대 건강 관리법

JSON 형식:
{
  "detailed_reason": "...",
  "risk_factors": ["요소1", "요소2", "요소3"],
  "nutrition_explanation": "...",
  "recommendation": "...",
  "global_remedies": [
    { "country": "Korea", "method": "..." },
    { "country": "China", "method": "..." },
    { "country": "India", "method": "..." },
    { "country": "USA", "method": "..." }
  ]
}`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.5-pro', [ { text: prompt } ]);
      }
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('Gemini detailed analysis error:', error);
      throw new Error(`Gemini detailed analysis failed: ${error.message}`);
    }
  }

  async urlToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });

      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return base64;
    } catch (error) {
      console.error('URL to base64 conversion error:', error);
      throw new Error(`Failed to convert URL to base64: ${error.message}`);
    }
  }

  /**
   * 의학적 분석 수행 (RAG 기반 프롬프트)
   */
  async generateMedicalAnalysis(prompt: string): Promise<any> {
    try {
      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.5-pro', [ { text: prompt } ]);
      }
      
      const jsonResult = this.extractJsonObject(rawText);
      
      // 점수가 없으면 기본값 설정
      if (!jsonResult.final_score) {
        jsonResult.final_score = this.calculateScoreFromLevel(
          jsonResult.interaction_assessment?.level || 'insufficient_data'
        );
      }
      
      return jsonResult;
    } catch (error) {
      console.error('Gemini medical analysis error:', error);
      throw new Error(`Gemini medical analysis failed: ${error.message}`);
    }
  }

  /**
   * 상호작용 레벨에서 점수 계산
   */
  private calculateScoreFromLevel(level: string): number {
    const scoreMap = {
      'safe': 90,
      'caution': 70,
      'danger': 40,
      'insufficient_data': 65,
    };
    return scoreMap[level] || 65;
  }

  /**
   * [2단계] AI가 음식 성분을 자유롭게 분석
   */
  async analyzeFoodComponents(
    foodName: string,
    diseases: string[]
  ): Promise<{
    components: Array<{ name: string; amount: string; description: string }>;
    riskFactors: {
      alcohol?: boolean;
      highSodium?: boolean;
      highPotassium?: boolean;
      caffeine?: boolean;
      citrus?: boolean;
      grapefruit?: boolean;
      dairy?: boolean;
      highFat?: boolean;
      vitaminK?: boolean;
      tyramine?: boolean;
      [key: string]: boolean | undefined;
    };
    nutritionSummary: string;
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      
      const prompt = `당신은 영양학 및 식품 성분 분석 전문가입니다.

음식: ${foodName}
사용자 질병: ${diseaseList}

음식의 주요 성분을 자유롭게 분석하세요. 고정된 카테고리에 제한받지 말고, 의학적으로 중요한 모든 성분을 파악하세요.

1. components (배열): 음식에 포함된 주요 성분 5~10개
   - name: 성분명 (예: "알코올", "나트륨", "칼륨", "카페인", "티라민", "비타민K", "자몽 추출물", "유당" 등)
   - amount: 대략적인 함량 (예: "12%", "500mg", "풍부", "소량", "중간" 등)
   - description: 성분 설명 및 건강 영향 (30자 이상)

2. riskFactors (객체): 약물과 상호작용 가능한 위험 성분
   - 성분이 실제로 포함되어 있으면 true, 아니면 false
   - 고정된 8가지에 제한하지 말고, 필요하면 새로운 필드 추가
   - 예시:
     * alcohol: 알코올 포함 여부
     * highSodium: 나트륨 하루 권장량 30% 이상
     * highPotassium: 칼륨 함량 높음
     * caffeine: 카페인 포함
     * citrus: 감귤류 포함
     * grapefruit: 자몽 포함
     * dairy: 유제품 포함
     * highFat: 지방 함량 높음
     * vitaminK: 비타민K 풍부 채소
     * tyramine: 티라민 함유 식품 (치즈, 발효식품 등)
     * 기타 필요한 성분 추가

3. nutritionSummary: 영양학적 종합 평가 (100자 이상)

JSON 형식으로만 응답:
{
  "components": [
    { "name": "알코올", "amount": "5%", "description": "간 기능에 영향..." },
    { "name": "나트륨", "amount": "800mg", "description": "혈압 상승 가능..." },
    ...
  ],
  "riskFactors": {
    "alcohol": true,
    "highSodium": true,
    "highPotassium": false,
    "caffeine": false,
    "citrus": false,
    "grapefruit": false,
    "dairy": false,
    "highFat": false,
    "vitaminK": false,
    "tyramine": false
  },
  "nutritionSummary": "해당 음식은..."
}`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.0-flash-exp', [ { text: prompt } ]);
      }
      
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('AI 음식 성분 분석 실패:', error);
      throw new Error(`AI food component analysis failed: ${error.message}`);
    }
  }

  /**
   * [4단계] AI가 음식 성분과 약물 공공데이터를 직접 비교하여 상호작용 판단
   */
  async analyzeDrugFoodInteractions(
    foodName: string,
    foodAnalysis: any,
    drugDetails: Array<{ name: string; publicData: any }>,
    diseases: string[]
  ): Promise<{
    interactions: Array<{
      medicine_name: string;
      risk_level: 'danger' | 'caution' | 'safe';
      matched_components: string[];
      interaction_description: string;
      evidence_from_public_data: string;
      recommendation: string;
    }>;
    summary: string;
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      const components = foodAnalysis.components || [];
      const riskFactors = foodAnalysis.riskFactors || {};
      
      const prompt = `당신은 약물-음식 상호작용 분석 전문가입니다.

음식: ${foodName}
사용자 질병: ${diseaseList}

AI가 분석한 음식 성분:
${JSON.stringify(components, null, 2)}

AI가 파악한 위험 요소:
${JSON.stringify(riskFactors, null, 2)}

사용자가 복용 중인 약물 및 e약은요 공공데이터:
${JSON.stringify(drugDetails, null, 2)}

**중요**: e약은요 공공데이터의 다음 필드를 정확히 분석하세요:
- atpnQesitm: 주의사항
- atpnWarnQesitm: 경고사항
- intrcQesitm: 상호작용
- seQesitm: 부작용
- useMethodQesitm: 복용방법
- efcyQesitm: 효능효과

각 약물에 대해 다음을 판단하세요:

1. 음식 성분과 약물 공공데이터를 직접 비교
   - 예: 음식에 "알코올 5%" → 약물 atpnWarnQesitm에 "음주 시 간 손상" 명시 → danger
   - 예: 음식에 "나트륨 800mg" → 약물이 고혈압약이고 atpnQesitm에 "염분 섭취 제한" → caution
   - 예: 음식에 "자몽" → 약물 intrcQesitm에 "자몽주스와 병용 금지" → danger

2. risk_level 판정 기준:
   - danger: 공공데이터에 명확한 금기사항이나 위험 경고가 있는 경우
   - caution: 주의사항이 있거나 잠재적 위험이 있는 경우
   - safe: 상호작용 없거나 안전한 경우

3. matched_components: 매칭된 음식 성분 배열 (예: ["알코올", "나트륨"])

4. evidence_from_public_data: 공공데이터에서 찾은 근거 (원문 인용)

JSON 형식으로만 응답:
{
  "interactions": [
    {
      "medicine_name": "타이레놀",
      "risk_level": "danger",
      "matched_components": ["알코올"],
      "interaction_description": "알코올과 아세트아미노펜 병용 시 간 손상 위험 증가",
      "evidence_from_public_data": "e약은요 경고사항: '음주 시 간 손상 위험'",
      "recommendation": "음주 후 최소 6시간 간격 유지"
    },
    ...
  ],
  "summary": "총 5개 약물 중 2개 위험(danger), 1개 주의(caution), 2개 안전(safe)"
}`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.0-flash-exp', [ { text: prompt } ]);
      }
      
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('AI 약물-음식 상호작용 분석 실패:', error);
      throw new Error(`AI drug-food interaction analysis failed: ${error.message}`);
    }
  }

  /**
   * [5단계] AI가 최종 종합 분석
   */
  async generateFinalAnalysis(
    foodName: string,
    foodAnalysis: any,
    interactionAnalysis: any,
    diseases: string[]
  ): Promise<{
    suitabilityScore: number;
    briefSummary: string;
    goodPoints: string[];
    badPoints: string[];
    summary: string;
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      
      const prompt = `당신은 건강 관리 종합 전문가입니다.

음식: ${foodName}
사용자 질병: ${diseaseList}

음식 성분 분석:
${JSON.stringify(foodAnalysis, null, 2)}

약물-음식 상호작용 분석:
${JSON.stringify(interactionAnalysis, null, 2)}

위 분석을 종합하여 다음을 제공하세요:

1. suitabilityScore (0-100): 적합도 점수
   - 위험(danger) 약물 있으면: 0-40
   - 주의(caution) 약물만 있으면: 40-70
   - 안전(safe)하지만 질병 고려: 70-85
   - 완전 안전: 85-100

2. briefSummary: Result01에 표시할 간략 요약 (50자 이내)
   - 예: "복용 중인 약과 상호작용 위험이 있습니다."
   - 예: "현재 복용 중인 약과 함께 드셔도 안전합니다."

3. goodPoints: 좋은 점 3~5개 (각 30자 이상)

4. badPoints: 나쁜 점 3~5개 (각 30자 이상)
   - 약물 상호작용을 우선적으로 언급
   - 예: "타이레놀 복용 시 알코올 성분이 간 손상 위험을 증가시킵니다."

5. summary: 종합 평가 (100자 이상)

JSON 형식으로만 응답:
{
  "suitabilityScore": 45,
  "briefSummary": "복용 중인 약과 상호작용 위험",
  "goodPoints": ["...", "...", "..."],
  "badPoints": ["타이레놀과 알코올 상호작용...", "...", "..."],
  "summary": "종합적으로..."
}`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.0-flash-exp', [ { text: prompt } ]);
      }
      
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('AI 최종 분석 실패:', error);
      throw new Error(`AI final analysis failed: ${error.message}`);
    }
  }

  /**
   * [6단계] AI가 건강 레시피 추천 (레시피 DB 참조)
   */
  async generateHealthyRecipes(
    foodName: string,
    finalAnalysis: any,
    recipeData: any,
    diseases: string[]
  ): Promise<string[]> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      
      const prompt = `당신은 건강 레시피 전문가입니다.

음식: ${foodName}
사용자 질병: ${diseaseList}

종합 분석 결과:
${JSON.stringify(finalAnalysis, null, 2)}

레시피 DB 데이터 (식품안전나라):
${JSON.stringify(recipeData, null, 2)}

레시피 DB 데이터를 참조하여 건강한 조리법을 추천하세요.
- 레시피 DB에 있는 정보를 우선적으로 활용
- DB에 없는 경우에만 일반적인 조리법 제안
- 사용자 질병을 고려한 건강 레시피 4~6개

JSON 형식으로만 응답:
{
  "recipes": [
    "재료와 조리법을 구체적으로 작성 (50자 이상)",
    "...",
    "..."
  ]
}`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callV1GenerateContent('gemini-2.5-flash', [ { text: prompt } ]);
      }
      
      const result = this.extractJsonObject(rawText);
      return result.recipes || [];
    } catch (error) {
      console.error('AI 레시피 추천 실패:', error);
      return [
        '신선한 재료를 사용하세요',
        '조리 시 염분과 당분을 적게 사용하세요',
        '채소를 많이 추가하면 더 건강해요'
      ];
    }
  }
}

