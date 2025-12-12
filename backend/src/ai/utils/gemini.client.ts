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
  private genAIBackup: GoogleGenerativeAI | null = null;
  private visionModel: any;
  private textModel: any;
  private proModel: any;
  private useBackupKey: boolean = false;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 최소 1초 간격

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Library models (will internally hit v1). Keep for primary path.
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.textModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.proModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    
    // 백업 API 키 설정 (메인 키가 무효하면 백업 키를 메인으로 사용)
    const backupKey = process.env.GEMINI_API_KEY_BACKUP;
    if (backupKey) {
      this.genAIBackup = new GoogleGenerativeAI(backupKey);
      console.log('[Gemini] 백업 API 키가 설정되었습니다.');
    }
  }

  // Rate limiting: 요청 간 최소 간격 보장
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[Gemini] Rate limiting: ${waitTime}ms 대기 중...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private getBaseUrl(): string {
    // Use v1beta for gemini-2.5-pro/flash models (required for proper quota management)
    return process.env.GEMINI_API_BASE?.trim() || 'https://generativelanguage.googleapis.com/v1beta';
  }

  private getCurrentApiKey(): string {
    if (this.useBackupKey && process.env.GEMINI_API_KEY_BACKUP) {
      return process.env.GEMINI_API_KEY_BACKUP;
    }
    return process.env.GEMINI_API_KEY || '';
  }

  private switchToBackupKey(): boolean {
    if (!this.useBackupKey && process.env.GEMINI_API_KEY_BACKUP) {
      this.useBackupKey = true;
      console.log('[Gemini] 🔄 백업 API 키로 전환합니다.');
      // 백업 키로 모델 재설정
      if (this.genAIBackup) {
        this.visionModel = this.genAIBackup.getGenerativeModel({ model: 'gemini-2.5-flash' });
        this.textModel = this.genAIBackup.getGenerativeModel({ model: 'gemini-2.5-flash' });
        this.proModel = this.genAIBackup.getGenerativeModel({ model: 'gemini-2.5-pro' });
      }
      return true;
    }
    return false;
  }

  private async callWithRestApi(
    model: string,
    parts: any[],
    apiKey?: string
  ): Promise<string> {
    // Rate limiting 적용
    await this.throttleRequest();
    
    const key = apiKey || this.getCurrentApiKey();
    if (!key) throw new Error('GEMINI_API_KEY not set');
    const url = `${this.getBaseUrl()}/models/${model}:generateContent?key=${key}`;
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
          rawText = await this.callWithRestApi('gemini-2.5-flash', [
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

  /**
   * 약품 이미지 분석 (약 봉지, 약품, 알약 등)
   * OCR + 약품 형태 인식으로 약품명 추출
   * @param imageBase64 이미지 Base64 데이터
   * @returns 인식된 약품 목록
   */
  async analyzeMedicineImage(imageBase64: string, retries = 2): Promise<{
    success: boolean;
    medicines: Array<{
      name: string;           // 약품명
      manufacturer?: string;  // 제조사 (인식된 경우)
      dosage?: string;        // 용량 (인식된 경우)
      shape?: string;         // 약품 형태 (정제, 캡슐, 시럽 등)
      color?: string;         // 색상
      imprint?: string;       // 각인 문자
      confidence: number;     // 인식 신뢰도 (0-100)
    }>;
    totalCount: number;
    imageType: 'prescription_bag' | 'pill_package' | 'loose_pills' | 'medicine_bottle' | 'unknown';
    rawText?: string;         // OCR로 인식된 전체 텍스트
    message?: string;
  }> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const prompt = `당신은 의약품 이미지 분석 전문가입니다.
이미지를 분석하여 약품 정보를 추출해주세요.

## 분석 대상
1. **약 봉지/처방전 봉투**: 약국에서 받은 처방약 봉지 (약품명, 용량, 복용법 텍스트 포함)
2. **개별 포장 약품**: 알약, 캡슐, 시럽 등 개별 포장된 약품
3. **낱개 알약**: 포장 없이 보이는 알약 (형태, 색상, 각인으로 식별)
4. **약품 병**: 시럽, 물약 등 병에 담긴 약품

## 분석 방법
1. **OCR 텍스트 인식**: 이미지에 보이는 모든 텍스트를 읽음
   - 약품명, 제조사, 용량, 성분, 복용법 등
2. **약품 형태 인식**: 알약의 모양, 색상, 각인 분석
3. **다수 약품 처리**: 여러 약품이 보이면 모두 개별적으로 식별

## 중요
- 정확하게 인식된 약품만 포함 (추측하지 말 것)
- 한글 약품명 우선, 없으면 영문 약품명
- 인식 불가능한 경우 confidence를 낮게 설정

JSON 형식으로만 응답:
{
  "success": true,
  "imageType": "prescription_bag|pill_package|loose_pills|medicine_bottle|unknown",
  "rawText": "이미지에서 인식된 전체 텍스트 (줄바꿈 포함)",
  "medicines": [
    {
      "name": "정확한 약품명",
      "manufacturer": "제조사 (인식된 경우, 없으면 null)",
      "dosage": "용량 예: 500mg (인식된 경우, 없으면 null)",
      "shape": "정제|캡슐|시럽|연고|주사|파우더|기타",
      "color": "흰색|노란색|분홍색|등 (인식된 경우)",
      "imprint": "각인 문자 (인식된 경우)",
      "confidence": 85
    }
  ],
  "totalCount": 1,
  "message": "분석 결과 요약 메시지"
}

이미지에서 약품을 찾을 수 없거나 분석 불가능한 경우:
{
  "success": false,
  "imageType": "unknown",
  "medicines": [],
  "totalCount": 0,
  "message": "약품을 인식할 수 없습니다. 더 선명한 이미지로 다시 시도해주세요."
}`;

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
          console.log(`[약품 이미지 분석] SDK 오류, REST API 시도 (${attempt + 1}/${retries + 1}):`, sdkError.message);
          // Fallback: direct v1 REST
          rawText = await this.callWithRestApi('gemini-2.5-flash', [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ]);
        }

        const parsed = this.extractJsonObject(rawText);
        console.log(`[약품 이미지 분석] 성공: ${parsed.totalCount}개 약품 인식`);
        return parsed;
      } catch (error) {
        lastError = error;
        console.error(`[약품 이미지 분석] 실패 (시도 ${attempt + 1}/${retries + 1}):`, error.message);
        
        if (attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`${waitTime}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 모든 재시도 실패 시 기본 응답
    console.error(`[약품 이미지 분석] 모든 시도 실패: ${lastError?.message}`);
    return {
      success: false,
      medicines: [],
      totalCount: 0,
      imageType: 'unknown',
      message: '이미지 분석에 실패했습니다. 다시 시도해주세요.',
    };
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
        rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
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
          rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
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

  /**
   * 공공데이터 없이 순수 AI 지식만으로 빠른 분석 수행
   * Result01용 - 간략한 정보만 제공 (각 항목 1줄씩)
   */
  async quickAIAnalysis(
    foodName: string,
    diseases: string[],
    medicines: string[] = [],
  ): Promise<{
    suitabilityScore: number;
    pros: string;
    cons: string;
    summary: string;
    warnings: string;
    expertAdvice: string;
  }> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
        const medicineList = medicines.length > 0 ? medicines.join(', ') : '없음';

        const prompt = `당신은 20년 경력의 약사이자 건강검진 전문의입니다.
빠르고 간결하게 분석해주세요.

【환자 정보】
- 음식: ${foodName}
- 질병: ${diseaseList}
- 복용 약: ${medicineList}

【요청】
각 항목을 정확히 1줄(50자 이내)로 작성하세요. 길게 쓰지 마세요.

JSON 형식:
{
  "suitabilityScore": 0-100 정수,
  "pros": "장점 1줄 (50자 이내)",
  "cons": "주의사항 1줄 (50자 이내)",
  "summary": "한줄 요약 (50자 이내)",
  "warnings": "경고 1줄 (50자 이내, 없으면 빈 문자열)",
  "expertAdvice": "전문가 조언 1줄 (50자 이내)"
}

예시:
{
  "suitabilityScore": 75,
  "pros": "단백질이 풍부하여 근육 유지에 도움됩니다",
  "cons": "나트륨이 높아 혈압 관리가 필요합니다",
  "summary": "적당량 섭취 시 건강에 좋은 음식입니다",
  "warnings": "고혈압 환자는 국물 섭취를 줄이세요",
  "expertAdvice": "채소와 함께 드시면 더욱 균형잡힌 식사가 됩니다"
}`;

        let rawText: string;
        try {
          const result = await this.textModel.generateContent(prompt);
          const response = await result.response;
          rawText = response.text();
        } catch (sdkError) {
          console.log(`quickAIAnalysis SDK 오류, REST API로 재시도 (시도 ${attempt + 1}/${maxRetries + 1})...`);
          rawText = await this.callWithRestApi('gemini-2.5-flash', [{ text: prompt }]);
        }
        
        const parsed = this.extractJsonObject(rawText);
        console.log('[quickAIAnalysis] 분석 완료:', { score: parsed.suitabilityScore, food: foodName });
        return parsed;
      } catch (error) {
        lastError = error;
        console.error(`quickAIAnalysis 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`, error.message);
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 실패 시 기본값
    console.warn('quickAIAnalysis 실패, 기본값 반환');
    return {
      suitabilityScore: 60,
      pros: `${foodName}은(는) 적절히 섭취하면 영양을 공급합니다`,
      cons: '과다 섭취는 피하시는 것이 좋습니다',
      summary: `${foodName}은(는) 적당량 섭취를 권장합니다`,
      warnings: diseases.length > 0 ? `${diseases[0]} 환자는 섭취량 조절이 필요합니다` : '',
      expertAdvice: '균형 잡힌 식단의 일부로 섭취하세요'
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
        rawText = await this.callWithRestApi('gemini-2.5-pro', [ { text: prompt } ]);
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
        rawText = await this.callWithRestApi('gemini-2.5-pro', [ { text: prompt } ]);
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
   * 재시도 로직을 포함한 API 호출 (Rate Limiting 대응 + 백업 키 자동 전환)
   * 할당량 소진 시 즉시 에러 발생 (무한 재시도 방지)
   * 분당 요청 제한만 재시도
   */
  private async callWithRetry(
    fn: () => Promise<string>,
    maxRetries: number = 1
  ): Promise<string> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error.response?.status || error.status;
        const isRateLimitError = status === 429 || error.message?.includes('429');
        
        // 에러 메시지 분석
        const errorMsg = error.message || '';
        const isQuotaExceeded = errorMsg.includes('quota') || errorMsg.includes('limit: 0');
        const isPerMinuteLimit = errorMsg.includes('PerMinute');
        const isPerDayLimit = errorMsg.includes('PerDay');
        const isAuthError = status === 401 || status === 403 || errorMsg.includes('API key') || errorMsg.includes('PERMISSION');

        // 인증/권한 오류 발생 시 백업 키로 전환 시도 (한 번만)
        if (isAuthError && !this.useBackupKey && process.env.GEMINI_API_KEY_BACKUP) {
          console.warn(`[Gemini] 인증/권한 오류 감지 (status=${status}) - 백업 키로 전환 시도`);
          if (this.switchToBackupKey()) {
            try {
              return await fn();
            } catch (backupError: any) {
              console.warn(`[Gemini] 백업 키도 실패: ${backupError.message}`);
              throw backupError;
            }
          }
        }

        // 할당량 완전 소진(limit: 0)은 백업 키로 전환, 그 외는 재시도하지 않음
        if (isRateLimitError && isQuotaExceeded && !this.useBackupKey && attempt === 0) {
          console.warn(`[Gemini] ⚠️ 할당량 소진 감지, 백업 키로 전환 시도...`);
          if (this.switchToBackupKey()) {
            try {
              return await fn();
            } catch (backupError: any) {
              console.warn(`[Gemini] 백업 키도 실패: ${backupError.message}`);
              throw backupError;
            }
          }
        }

        // 할당량 완전 소진(limit: 0)은 재시도하지 않고 즉시 에러 발생
        if (isQuotaExceeded && errorMsg.includes('limit: 0')) {
          console.warn(`[Gemini] 할당량 완전 소진(limit: 0) - 즉시 에러 발생`);
          throw error;
        }

        // 분당 요청 제한만 재시도 (1회)
        if (isRateLimitError && isPerMinuteLimit && attempt < maxRetries) {
          const delay = 2000 + Math.random() * 1000; // 2-3초
          console.warn(`[Gemini] 분당 요청 제한 – ${delay.toFixed(0)}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 일일 할당량은 재시도하지 않음 (내일까지 대기 필요)
        if (isPerDayLimit) {
          console.warn(`[Gemini] 일일 할당량 한계 - 내일 재시도 필요`);
          throw error;
        }

        console.warn(`[Gemini] 요청 실패: status=${status}, attempt=${attempt}, msg=${errorMsg.substring(0, 100)}`);
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  async analyzeFoodComponents(
    foodName: string,
    diseases: string[],
    publicDatasets?: {
      nutrition?: any;
      healthFunctionalFoods?: any;
      diseaseInfo?: any;
    }
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
    riskFactorNotes: Record<string, string>;
    referenceData?: any;
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      
      // 🆕 공개데이터 다이제스트 (전체가 아닌 필요한 부분만)
      let nutritionSummary = '데이터 없음';
      if (publicDatasets?.nutrition?.items && Array.isArray(publicDatasets.nutrition.items)) {
        const item = publicDatasets.nutrition.items[0];
        if (item) {
          const calories = item.AMT_NUM1 || '정보 없음';
          const protein = item.AMT_NUM3 || '정보 없음';
          const fat = item.AMT_NUM4 || '정보 없음';
          const carbs = item.AMT_NUM5 || '정보 없음';
          const sodium = item.AMT_NUM13 || '정보 없음';
          const foodName = item.FOOD_NM_KR || '음식';
          
          nutritionSummary = `[${foodName}] 100g당: 에너지 ${calories}kcal, 단백질 ${protein}g, 지방 ${fat}g, 탄수화물 ${carbs}g, 나트륨 ${sodium}mg`;
        }
      }
      
      const prompt = `영양 분석 요청
음식: ${foodName}
질병: ${diseaseList}
공개데이터 요약: ${nutritionSummary}

JSON만 반환:
{
  "components": [
    {"name": "성분", "amount": "함량", "description": "50자 이상 설명"}
  ],
  "riskFactors": {
    "alcohol": false, "highSodium": false, "highPotassium": false,
    "caffeine": false, "citrus": false, "grapefruit": false,
    "dairy": false, "highFat": false, "vitaminK": false, "tyramine": false
  },
  "riskFactorNotes": {},
  "nutritionSummary": "200자 이상 요약 (질병과 연결)"
}`;

      let rawText: string;
      try {
        rawText = await this.callWithRetry(async () => {
          const result = await this.proModel.generateContent(prompt);
          const response = await result.response;
          return response.text();
        }, 4);
      } catch (sdkError) {
        console.warn('[Gemini] pro 모델 실패, 2.5-flash로 fallback 시도:', sdkError.message);
        rawText = await this.callWithRetry(async () => {
          return await this.callWithRestApi('gemini-2.5-flash', [{ text: prompt }]);
        }, 4);
      }
      
      const parsed = this.extractJsonObject(rawText);
      return {
        ...parsed,
        referenceData: publicDatasets,
      };
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
    drugDetails: Array<{ name: string; analyzedInfo?: any; publicData?: any }>,
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

      // 약품 정보를 요약 형식으로 변환 (캐시된 AI 분석 우선 사용)
      const medicinesSummary = drugDetails.map((drug) => {
        if (drug.analyzedInfo) {
          // 등록 시 저장된 AI 분석 사용 (이미 요약됨)
          return {
            name: drug.name,
            efficacy: drug.analyzedInfo.efficacy || '정보 없음',
            usage: drug.analyzedInfo.usage || '정보 없음',
            sideEffects: drug.analyzedInfo.sideEffects || '정보 없음',
            precautions: drug.analyzedInfo.precautions || '정보 없음',
            interactions: drug.analyzedInfo.interactions || '정보 없음',
            components: drug.analyzedInfo.components || [],
          };
        } else if (drug.publicData) {
          // 공공데이터 요약 (필수 필드만)
          return {
            name: drug.name,
            efficacy: drug.publicData.efcyQesitm ? drug.publicData.efcyQesitm.substring(0, 200) + '...' : '정보 없음',
            precautions: drug.publicData.atpnQesitm ? drug.publicData.atpnQesitm.substring(0, 150) + '...' : '정보 없음',
            interactions: drug.publicData.intrcQesitm ? drug.publicData.intrcQesitm.substring(0, 150) + '...' : '정보 없음',
            sideEffects: drug.publicData.seQesitm ? drug.publicData.seQesitm.substring(0, 100) + '...' : '정보 없음',
          };
        } else {
          return { name: drug.name, note: 'AI 분석 필요' };
        }
      });
      
      const prompt = `당신은 약물-음식 상호작용 분석 전문가입니다.

**중요 원칙:**
1. 약물 정보에 근거가 있으면 사실 기반으로 분석
2. 근거가 불충분하면 보수적으로 판단 (안전 우선)
3. 근거를 찾을 수 없어도 "찾을 수 없다" 같은 부정적 표현 금지
4. 불확실한 경우 "의료 전문가 확인 권장" 메시지 제공

음식: ${foodName}
사용자 질병: ${diseaseList}

음식 성분:
${JSON.stringify(components, null, 2)}

음식 위험 요소:
${JSON.stringify(riskFactors, null, 2)}

복용 약물 정보 (요약):
${JSON.stringify(medicinesSummary, null, 2)}

각 약물에 대해 다음을 판단하세요:

1. **음식 성분과 약물 정보 비교**
   ✅ 직접적 매칭 예시:
   - 음식에 "알코올 5%" + 약물 주의사항 "음주 시 간 손상" → danger
   - 음식에 "나트륨 800mg" + 약물 "고혈압약" + 주의사항 "염분 제한" → caution
   - 음식에 "자몽" + 약물 상호작용 "자몽주스 병용 금지" → danger

2. **risk_level 판정 기준** (보수적 판단)
   - **danger**: 약물 정보에 명확한 금기사항/위험 경고 OR 잠재적으로 심각한 상호작용 가능
   - **caution**: 주의사항 있음 OR 잠재적 위험 가능성 있음
   - **safe**: 명백히 안전하거나 상호작용 없음

3. **matched_components** (필수)
   - 매칭된 음식 성분 배열 (예: ["알코올", "나트륨"])
   - foodAnalysis.components의 name을 그대로 활용
   - 매칭 없으면 빈 배열 []

4. **interaction_description** (80자 이상, 필수)
   ✅ 음식 성분 위주로 설명 (예: "소주의 알코올 성분이 타이레놀과 함께 섭취 시 간 손상을 유발합니다")
   ❌ 약 자체의 설명 제외 (예: "타이레놀은 해열진통제로..." 같은 설명 금지)
   ⚠️ 근거 불충분 시: "이 음식의 [성분명] 성분이 약물 효과에 영향을 줄 수 있으므로 주의가 필요합니다"

5. **evidence_from_public_data** (필수, 절대 빈 문자열 금지)
   ✅ 약물 정보에 직접적 근거 있음 → 해당 문구 인용 (예: "약물 주의사항: '음주 시 간 손상 위험'")
   ⚠️ 직접적 근거 없지만 관련 정보 있음 → 관련 내용 요약 (예: "약물 효능: 혈압 강하 작용. 나트륨 과다 섭취 시 약효 감소 가능")
   ❌ 근거 전혀 없음 → "약물 분류와 일반적인 의학 지식을 바탕으로 한 분석입니다. 정확한 상호작용은 의사 또는 약사와 상담하세요"
   
   **절대 금지 표현:**
   - "찾을 수 없다"
   - "정보가 없다"
   - "불명확하다"

6. **recommendation** (50자 이상, 구체적 행동 지침)
   ✅ 구체적 예시: "음주 후 최소 6시간 간격 유지, 가능하면 당일 복용 금지"
   ⚠️ 근거 불충분 시: "복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 의료 전문가와 상담하세요"

JSON 형식으로만 응답:
{
  "interactions": [
    {
      "medicine_name": "타이레놀",
      "risk_level": "danger",
      "matched_components": ["알코올"],
      "interaction_description": "소주의 알코올 성분이 타이레놀과 함께 섭취 시 간 손상 위험을 크게 증가시킵니다",
      "evidence_from_public_data": "약물 주의사항: '음주 시 간 손상 위험'",
      "recommendation": "음주 후 최소 6시간 간격 유지, 가능하면 당일 복용 금지"
    },
    {
      "medicine_name": "혈압약",
      "risk_level": "caution",
      "matched_components": ["나트륨"],
      "interaction_description": "이 음식의 나트륨 함량이 높아 혈압 조절에 영향을 줄 수 있습니다",
      "evidence_from_public_data": "약물 효능: 혈압 강하 작용. 고염식은 약효를 감소시킬 수 있습니다",
      "recommendation": "국물을 절반만 드시고, 염분 섭취를 하루 2,000mg 이하로 유지하세요"
    },
    {
      "medicine_name": "비타민D",
      "risk_level": "safe",
      "matched_components": [],
      "interaction_description": "이 음식과 비타민D는 안전하게 함께 섭취할 수 있으며, 오히려 흡수를 돕는 효과가 있습니다",
      "evidence_from_public_data": "비타민D는 지용성 비타민으로, 식사와 함께 섭취 시 흡수율이 증가합니다",
      "recommendation": "식사 직후 또는 식사 중에 복용하시면 흡수가 더 잘 됩니다"
    }
  ],
  "summary": "총 3개 약물 중 1개 위험(danger), 1개 주의(caution), 1개 안전(safe). 음주와 고염식 주의 필요"
}`;

      // 🔄 재시도 로직 적용 (429 에러 대응)
      let rawText: string;
      try {
        rawText = await this.callWithRetry(async () => {
          const result = await this.proModel.generateContent(prompt);
          const response = await result.response;
          return response.text();
        });
      } catch (sdkError: any) {
        // 429 할당량 소진 시 기본 안전 응답 반환
        if (sdkError.message?.includes('429') || sdkError.status === 429) {
          console.warn('[analyzeDrugFoodInteractions] 429 에러 - 안전 기본 응답 반환');
          return {
            interactions: drugDetails.map(drug => ({
              medicine_name: drug.name,
              risk_level: 'caution',
              matched_components: [],
              interaction_description: `이 음식과 ${drug.name}의 상호작용을 AI로 분석하지 못했습니다. 안전을 위해 의료 전문가와 상담하세요.`,
              evidence_from_public_data: 'AI 분석 일시 불가 - 보수적 권장 사항 제공',
              recommendation: '복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 약사 또는 의사와 상담하세요.'
            })),
            summary: `${drugDetails.length}개 약물 모두 보수적 주의 권장 - 상세 상담 필요`
          };
        }
        
        console.warn('[analyzeDrugFoodInteractions] SDK 실패, V1 API로 폴백:', sdkError.message);
        try {
          rawText = await this.callWithRetry(async () => {
            return await this.callWithRestApi('gemini-2.5-pro', [ { text: prompt } ]);
          });
        } catch (v1Error: any) {
          // V1도 실패 시 기본 안전 응답
          if (v1Error.message?.includes('429') || v1Error.status === 429) {
            console.warn('[analyzeDrugFoodInteractions] V1도 429 에러 - 안전 기본 응답 반환');
            return {
              interactions: drugDetails.map(drug => ({
                medicine_name: drug.name,
                risk_level: 'caution',
                matched_components: [],
                interaction_description: `이 음식과 ${drug.name}의 상호작용을 AI로 분석하지 못했습니다. 안전을 위해 의료 전문가와 상담하세요.`,
                evidence_from_public_data: 'AI 분석 일시 불가 - 보수적 권장 사항 제공',
                recommendation: '복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 약사 또는 의사와 상담하세요.'
              })),
              summary: `${drugDetails.length}개 약물 모두 보수적 주의 권장 - 상세 상담 필요`
            };
          }
          throw v1Error;
        }
      }
      
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('AI 약물-음식 상호작용 분석 실패:', error);
      // 최후의 fallback - 모든 약물에 대해 caution 반환
      return {
        interactions: drugDetails.map(drug => ({
          medicine_name: drug.name,
          risk_level: 'caution',
          matched_components: [],
          interaction_description: `이 음식과 ${drug.name}의 상호작용을 분석할 수 없습니다. 안전을 위해 의료 전문가와 상담해주세요.`,
          evidence_from_public_data: '분석 불가 - 보수적 권장 사항 제공',
          recommendation: '복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 약사 또는 의사와 상담하세요.'
        })),
        summary: `${drugDetails.length}개 약물 모두 보수적 주의 권장 - 전문가 상담 필수`
      };
    }
  }

  /**
   * [5단계] AI가 최종 종합 분석
   * 출력 형식: 좋은점, 주의점, 경고, 전문가조언, 종합분석
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
    warnings: string[];
    expertAdvice: string;
    summary: string;
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      const drugList = interactionAnalysis?.interactions?.map((i: any) => i.medicine_name).join(', ') || '없음';
      
      const prompt = `# Role Definition
당신은 20년 경력의 **'임상 약사(Clinical Pharmacist)'**이자 **'임상 영양학자(Clinical Nutritionist)'**입니다.
당신의 목표는 사용자의 [질병], [복용 약물], [섭취 음식] 데이터를 바탕으로 **근거 중심(Evidence-based)**의 정밀 분석 리포트를 작성하는 것입니다.

---

# Input Data Context
**사용자 프로필:**
- 질병 목록: ${diseaseList}
- 복용 약물: ${drugList}
- 분석 음식: ${foodName}

**음식 성분 분석 데이터:**
${JSON.stringify(foodAnalysis, null, 2)}

**약물-음식 상호작용 분석 데이터:**
${JSON.stringify(interactionAnalysis, null, 2)}

---

# Output Format (정확히 이 형식으로 작성)

다음 순서대로 분석 결과를 JSON으로 제공하세요:

1. **suitabilityScore** (0-100): 적합도 점수
   - danger 약물 있으면: 0-40점
   - caution 약물만: 40-70점
   - safe하지만 질병 고려: 70-85점
   - 완전 안전: 85-100점

2. **goodPoints** (배열): ✅ 좋은 점 3-5개
   - 음식의 영양학적 장점
   - 질병 관리에 도움되는 점
   - 각 항목 50자 이상

3. **badPoints** (배열): ⚠️ 주의할 점 2-4개
   - 질병이나 약물과의 주의사항
   - 과다 섭취 시 문제점
   - 각 항목 50자 이상

4. **warnings** (배열): 🚨 경고 1-3개
   - 반드시 알아야 할 위험한 상호작용
   - [DANGER] 등급 약물과의 관계
   - 빈 배열 가능 (경고 없으면 [])

5. **expertAdvice** (문자열): 💊 AI 전문가 조언
   - 친근하고 따뜻한 어조로 2-3문장
   - 실용적인 섭취 가이드 포함
   - 100자 이상

6. **briefSummary** (문자열): 간략 요약 (200자 내외)
   - 음식 자체 평가 + 약물과의 관계

7. **summary** (문자열): 🔬 최종 종합 분석
   - 약물/음식 분석 + AI 전문가 분석 합산
   - 1) 음식-질병 관계 평가
   - 2) 음식-약물 관계 평가  
   - 3) 최종 권장사항
   - 200자 이상

JSON 형식으로만 응답:
{
  "suitabilityScore": 75,
  "goodPoints": [
    "✅ 단백질이 풍부하여 근육 유지와 면역력 강화에 도움됩니다",
    "✅ 비타민B군이 에너지 대사를 촉진하고 피로 회복에 효과적입니다",
    "✅ 아연이 포함되어 상처 치유와 면역 기능을 지원합니다"
  ],
  "badPoints": [
    "⚠️ 나트륨 함량이 높아 고혈압 환자는 국물 섭취를 줄여야 합니다",
    "⚠️ 포화지방이 있어 고지혈증 환자는 적당량만 섭취하세요"
  ],
  "warnings": [
    "🚨 [DANGER] 와파린 복용 중이라면 비타민K가 약효를 감소시킬 수 있습니다"
  ],
  "expertAdvice": "💊 이 음식은 영양가가 높지만, 복용 중인 약물을 고려하여 식후 2시간 뒤에 드시는 것을 권장합니다. 국물보다는 건더기 위주로 드시면 나트륨 섭취를 줄일 수 있어요.",
  "briefSummary": "영양가 높은 음식이지만 고혈압약과 함께 섭취 시 나트륨 주의가 필요합니다...",
  "summary": "🔬 [최종 종합 분석] 이 음식은 단백질과 비타민이 풍부하여 영양학적으로 우수합니다. 다만, 현재 복용 중인 고혈압약(OO)과 관련하여 나트륨 섭취에 주의가 필요합니다. 약물 복용 2시간 전후로 섭취하시고, 국물은 절반만 드시는 것을 권장합니다."
}`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-pro', [ { text: prompt } ]);
      }
      
      const parsed = this.extractJsonObject(rawText);
      
      // warnings가 없으면 빈 배열로 설정
      if (!parsed.warnings) {
        parsed.warnings = [];
      }
      // expertAdvice가 없으면 기본값 설정
      if (!parsed.expertAdvice) {
        parsed.expertAdvice = '균형 잡힌 식단의 일부로 적당량 섭취하시면 건강에 도움이 됩니다.';
      }
      
      return parsed;
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
      const drugList = finalAnalysis?.medicalAnalysis?.drug_food_interactions?.map((i: any) => i.medicine_name).join(', ') || '없음';
      
      const prompt = `# Role Definition
당신은 20년 경력의 **'임상 영양사(Clinical Dietitian)'**이자 **'약사(Pharmacist)'**입니다.
사용자는 특정 음식(메뉴)을 먹고 싶어 하며, 당신의 역할은 이 음식을 **'금지'하는 것이 아니라, 사용자의 질병과 복용 약물에 맞춰 '가장 건강하게 먹는 방법'을 컨설팅**하는 것입니다.

---

# Input Data Context
**분석 대상 음식:** ${foodName}
- *이것이 사용자가 먹고 싶어하는 음식입니다. 절대 다른 메뉴로 변경하지 마세요.*

**사용자 프로필:**
- 질병: ${diseaseList}
- 복용 약물: ${drugList}

**종합 분석 결과:**
${JSON.stringify(finalAnalysis, null, 2)}

**레시피 DB 데이터 (식품안전나라):**
${JSON.stringify(recipeData, null, 2)}

---

# Recipe Engineering Logic (조리법 최적화)

## Step 1. 위험 요소 파악
종합 분석 결과에서 badPoints를 확인하여 이 음식의 문제점(고나트륨, 고당, 고지방 등)을 파악하세요.

## Step 2. 조리법 솔루션 ★매우 중요
**사용자가 요청한 '${foodName}'을 기준으로 조리법을 수정하세요.**
- ❌ 절대 샐러드나 죽 같은 다른 음식을 추천하지 마세요
- ✅ 해당 음식을 만들 때 재료를 대체하거나 조리 방식을 바꿔 위험 요소를 제거하세요
- *예시: "라면을 먹고 싶다" → "면을 한번 삶아 기름을 빼고, 스프는 절반만 넣으세요. 부족한 간은 마늘과 파로 채우세요."*

## Step 3. 실용적인 팁 작성
각 팁은 다음 3가지 카테고리로 분류하세요:
1. **[재료 변경]** - 건강하지 않은 재료를 대체하는 방법
2. **[조리법 변경]** - 튀김→굽기, 삶기 등 조리 방식 수정
3. **[섭취 팁]** - 먹는 방법, 시간대, 함께 먹으면 좋은 것

---

# Output Format
JSON 배열로 4-6개의 구체적인 팁을 반환하세요:

[
  "[재료 변경] 설탕 대신 알룰로스를 사용하여 당 수치를 낮추세요.",
  "[조리법 변경] 튀기는 대신 에어프라이어를 사용해 트랜스지방을 90% 줄이세요.",
  "[섭취 팁] 국물은 섭취하지 말고 건더기 위주로 드세요. 나트륨 섭취를 하루 권장량의 절반 이하로 줄일 수 있습니다.",
  "[재료 변경] 라면 스프는 절반만 사용하고, 부족한 간은 마늘, 생강, 파로 보충하세요.",
  "[섭취 팁] 약 복용 후 최소 2시간 뒤에 섭취하여 약물 흡수를 방해하지 않도록 하세요.",
  "[조리법 변경] 면을 먼저 한번 삶아 기름기를 제거한 후 새 물에 다시 끓이세요."
]

---

# Constraints
1. **Don't change the menu:** 사용자가 요청한 ${foodName} 내에서 해결책을 찾으세요
2. **Be Specific:** "적당히", "건강하게" 같은 추상적 표현 대신 "스프 절반만", "에어프라이어 180도 15분" 등 구체적으로 작성
3. **Supportive Tone:** "절대 먹지 마세요" 대신 "이렇게 조리하면 더 건강하게 즐기실 수 있습니다" 같은 격려하는 어조 사용
4. 레시피 DB에 있는 정보를 우선적으로 활용
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
        rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
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

  /**
   * [5단계 최적화] 최종 분석 + 건강 레시피를 하나의 AI 호출로 통합
   * 기존: generateFinalAnalysis (Gemini Pro) + generateHealthyRecipes (Gemini Flash) = 2회 호출
   * 최적화: 하나의 Gemini Pro 호출로 통합 → 약 5-7초 절약
   */
  async generateFinalAnalysisWithRecipes(
    foodName: string,
    foodAnalysis: any,
    interactionAnalysis: any,
    diseases: string[],
    recipeData: any,
    options?: {
      needDetailedNutrition?: boolean;
      needDetailedRecipes?: boolean;
      publicDataFailed?: boolean;
    }
  ): Promise<{
    finalAnalysis: {
      suitabilityScore: number;
      briefSummary: string;
      goodPoints: string[];
      badPoints: string[];
      warnings: string[];
      expertAdvice: string;
      summary: string;
    };
    healthyRecipes: string[];
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(', ') : '없음';
      const drugList = interactionAnalysis?.interactions?.map((i: any) => i.medicine_name).join(', ') || '없음';
      
      // 공공데이터 부족 시 AI가 더 상세하게 분석하도록 지시
      const needDetailedAnalysis = options?.needDetailedNutrition || options?.needDetailedRecipes || options?.publicDataFailed;
      const detailInstruction = needDetailedAnalysis ? `
⚠️ **중요**: 공공데이터(영양성분DB, 레시피DB)에서 데이터를 가져오지 못했습니다.
따라서 당신의 전문 지식을 활용하여 다음을 **반드시 상세하게** 작성해주세요:
- goodPoints: 각 항목 80자 이상, 구체적인 영양소와 효능 설명
- badPoints: 각 항목 80자 이상, 구체적인 위험 요소와 이유 설명
- warnings: 해당되는 경우 상세한 경고 메시지
- expertAdvice: 150자 이상의 전문가 조언
- summary: 300자 이상의 종합 분석
- healthyRecipes: 6개 이상의 구체적인 조리/섭취 팁 (각 50자 이상)
` : '';
      
      const prompt = `# Role Definition
당신은 20년 경력의 **'임상 약사(Clinical Pharmacist)'**이자 **'임상 영양학자(Clinical Nutritionist)'**입니다.
${detailInstruction}
---

# Input Data Context
**사용자 프로필:**
- 질병 목록: ${diseaseList}
- 복용 약물: ${drugList}
- 분석 음식: ${foodName}

**음식 성분 분석 데이터:**
${JSON.stringify(foodAnalysis, null, 2)}

**약물-음식 상호작용 분석 데이터:**
${JSON.stringify(interactionAnalysis, null, 2)}

**레시피 DB 데이터 (식품안전나라):**
${recipeData && recipeData.length > 0 ? JSON.stringify(recipeData.slice(0, 3), null, 2) : '레시피 데이터 없음 - AI가 전문 지식으로 상세한 조리법/섭취 팁 생성 필요'}

---

# Output Requirements (2가지를 한번에 생성)

## Part 1: 최종 종합 분석
1. **suitabilityScore** (0-100): 적합도 점수
   - danger 약물 있으면: 0-40점
   - caution 약물만: 40-70점
   - safe하지만 질병 고려: 70-85점
   - 완전 안전: 85-100점

2. **goodPoints** (배열 3-5개): ✅ 좋은 점 (각 ${needDetailedAnalysis ? '80' : '50'}자 이상, 구체적인 영양소/효능 포함)
3. **badPoints** (배열 2-4개): ⚠️ 주의할 점 (각 ${needDetailedAnalysis ? '80' : '50'}자 이상, 구체적인 이유 포함)
4. **warnings** (배열 0-3개): 🚨 경고 (위험한 상호작용만, 구체적으로)
5. **expertAdvice** (문자열): 💊 AI 전문가 조언 (${needDetailedAnalysis ? '150' : '100'}자 이상, 친근한 어조로 실용적 조언)
6. **briefSummary** (문자열): 간략 요약 (200자 내외)
7. **summary** (문자열): 🔬 최종 종합 분석 (${needDetailedAnalysis ? '300' : '200'}자 이상, 영양학적/약학적 관점 종합)

## Part 2: 건강 레시피 팁
**healthyRecipes** (배열 ${needDetailedAnalysis ? '6-8' : '4-6'}개): ${foodName}을 건강하게 조리/섭취하는 방법
- ❌ 절대 다른 음식 추천 금지! ${foodName} 자체를 어떻게 먹을지만 답변
- ✅ [재료 변경], [조리법 변경], [섭취 팁], [약 복용 시] 카테고리로 구체적 작성
- 각 항목 ${needDetailedAnalysis ? '50' : '30'}자 이상 상세 설명

---

# JSON Output Format
{
  "finalAnalysis": {
    "suitabilityScore": 75,
    "goodPoints": ["✅ 단백질이 풍부하여 근육 형성에 도움이 되며, 특히 류신 함량이 높아 근육 단백질 합성을 촉진합니다.", "✅ 비타민B군이 풍부하여 에너지 대사를 활성화하고 피로 회복에 효과적입니다.", "✅ ..."],
    "badPoints": ["⚠️ 나트륨 함량이 1인분당 약 800mg으로 높아, 고혈압 환자의 경우 혈압 상승의 원인이 될 수 있습니다.", "⚠️ ..."],
    "warnings": ["🚨 [DANGER] 와파린 복용 중이시라면 비타민K가 풍부한 이 음식이 약효를 감소시킬 수 있으니 섭취량을 제한하세요."],
    "expertAdvice": "💊 이 음식은 영양가가 높지만 복용 중인 약물과의 상호작용을 고려해야 합니다. 특히 식후 2시간 후에 약을 복용하시면 상호작용을 최소화할 수 있습니다. 1주일에 2-3회 정도 적당량을 드시는 것을 권장합니다.",
    "briefSummary": "영양가 높은 음식이지만 복용 약물과의 상호작용에 주의가 필요합니다.",
    "summary": "🔬 [최종 종합 분석] 이 음식은 단백질과 비타민이 풍부하여 건강에 유익하지만, 현재 복용 중인 약물과의 상호작용을 고려해야 합니다. 특히 나트륨 함량이 높아 고혈압 환자분은 섭취량을 조절하시고, 약 복용 시간과 식사 시간을 분리하시면 약효를 유지하면서 영양 섭취도 가능합니다."
  },
  "healthyRecipes": [
    "[재료 변경] 일반 소금 대신 저염간장이나 레몬즙을 사용하면 나트륨 섭취를 30% 이상 줄일 수 있습니다",
    "[조리법 변경] 기름에 튀기는 대신 에어프라이어나 오븐에서 구우면 지방 섭취를 크게 줄일 수 있습니다",
    "[섭취 팁] 국물보다 건더기 위주로 드시면 나트륨 섭취를 절반으로 줄일 수 있습니다",
    "[섭취 팁] 채소를 곁들여 드시면 식이섬유가 나트륨 배출을 도와줍니다",
    "[약 복용 시] 약 복용 2시간 전후로 드시면 약물 흡수에 영향을 최소화할 수 있습니다",
    "[섭취량 조절] 1인분의 2/3 정도만 드시고 나머지는 다음 끼니로 미루세요"
  ]
}`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-pro', [ { text: prompt } ]);
      }
      
      const parsed = this.extractJsonObject(rawText);
      
      // 기본값 설정 및 검증
      const finalAnalysis = parsed.finalAnalysis || {};
      
      // goodPoints 검증 - 배열이 아니거나 비어있으면 기본값
      if (!Array.isArray(finalAnalysis.goodPoints) || finalAnalysis.goodPoints.length === 0) {
        finalAnalysis.goodPoints = [
          `✅ ${foodName}에는 다양한 영양소가 포함되어 있어 균형 잡힌 식단에 도움이 됩니다.`,
          `✅ 적절한 양을 섭취하면 일일 영양 권장량을 채우는 데 기여합니다.`,
          `✅ 다양한 조리법으로 즐길 수 있어 식단의 다양성을 높여줍니다.`,
        ];
      }
      
      // badPoints 검증
      if (!Array.isArray(finalAnalysis.badPoints) || finalAnalysis.badPoints.length === 0) {
        finalAnalysis.badPoints = [
          `⚠️ 과다 섭취 시 영양 불균형이 발생할 수 있으니 적정량을 유지하세요.`,
          `⚠️ 복용 중인 약물이 있다면 식사 시간과 약 복용 시간을 분리하는 것이 좋습니다.`,
        ];
      }
      
      if (!finalAnalysis.warnings) finalAnalysis.warnings = [];
      
      if (!finalAnalysis.expertAdvice || finalAnalysis.expertAdvice.length < 50) {
        finalAnalysis.expertAdvice = `💊 ${foodName}은(는) 영양가가 있는 음식입니다. 복용 중인 약물이 있다면 식후 1-2시간 간격을 두고 약을 드시는 것이 좋습니다. 균형 잡힌 식단의 일부로 적당량 섭취하시면 건강 유지에 도움이 됩니다. 특별한 질환이 있으시다면 담당 의사와 상담 후 섭취량을 조절하세요.`;
      }
      
      if (!finalAnalysis.summary || finalAnalysis.summary.length < 100) {
        finalAnalysis.summary = `🔬 [최종 종합 분석] ${foodName}은(는) 다양한 영양소를 함유하고 있는 음식입니다. 복용 중인 약물과의 상호작용을 고려하여 식사 시간을 조절하시고, 질병 상태에 따라 섭취량을 적절히 조절하시면 건강한 식단의 일부로 즐기실 수 있습니다. 전문가와 상담하여 개인 맞춤형 식이 조절을 하시면 더욱 좋습니다.`;
      }
      
      if (!finalAnalysis.briefSummary || finalAnalysis.briefSummary.length < 30) {
        finalAnalysis.briefSummary = `${foodName}은(는) 영양가 있는 음식이지만, 복용 약물과의 상호작용을 고려하여 적절히 섭취하세요.`;
      }
      
      // healthyRecipes 검증 - 배열이 아니거나 항목이 부족하면 보강
      let healthyRecipes = parsed.healthyRecipes || [];
      if (!Array.isArray(healthyRecipes) || healthyRecipes.length < 4) {
        healthyRecipes = [
          `[재료 변경] ${foodName} 조리 시 소금 대신 저염 양념이나 천연 향신료를 사용하면 나트륨 섭취를 줄일 수 있습니다`,
          `[조리법 변경] 튀기는 대신 굽거나 찌는 조리법을 선택하면 지방 섭취를 줄이고 영양소 손실을 최소화할 수 있습니다`,
          `[섭취 팁] 채소와 함께 섭취하면 식이섬유가 소화를 도와 영양 흡수를 개선합니다`,
          `[섭취 팁] 천천히 꼭꼭 씹어 드시면 소화에 도움이 되고 포만감도 오래 유지됩니다`,
          `[약 복용 시] 약 복용과 식사 시간을 1-2시간 간격으로 분리하면 약물 흡수에 영향을 줄일 수 있습니다`,
          `[섭취량 조절] 1회 섭취량을 적정 수준으로 유지하고 과식하지 않도록 주의하세요`,
        ];
      }
      
      return { finalAnalysis, healthyRecipes };
    } catch (error) {
      console.error('AI 통합 분석 실패:', error);
      // 폴백: 상세한 기본값 반환
      return {
        finalAnalysis: {
          suitabilityScore: 50,
          briefSummary: `${foodName}은(는) 영양가 있는 음식이지만, 복용 약물과의 상호작용을 고려하여 적절히 섭취하세요.`,
          goodPoints: [
            `✅ ${foodName}에는 다양한 영양소가 포함되어 있어 균형 잡힌 식단에 도움이 됩니다.`,
            `✅ 적절한 양을 섭취하면 일일 영양 권장량을 채우는 데 기여합니다.`,
            `✅ 다양한 조리법으로 즐길 수 있어 식단의 다양성을 높여줍니다.`,
          ],
          badPoints: [
            `⚠️ 과다 섭취 시 영양 불균형이 발생할 수 있으니 적정량을 유지하세요.`,
            `⚠️ 복용 중인 약물이 있다면 식사 시간과 약 복용 시간을 분리하는 것이 좋습니다.`,
          ],
          warnings: [],
          expertAdvice: `💊 ${foodName}은(는) 영양가가 있는 음식입니다. 복용 중인 약물이 있다면 식후 1-2시간 간격을 두고 약을 드시는 것이 좋습니다. 균형 잡힌 식단의 일부로 적당량 섭취하시면 건강 유지에 도움이 됩니다.`,
          summary: `🔬 [최종 종합 분석] ${foodName}은(는) 다양한 영양소를 함유하고 있는 음식입니다. 복용 중인 약물과의 상호작용을 고려하여 식사 시간을 조절하시고, 질병 상태에 따라 섭취량을 적절히 조절하시면 건강한 식단의 일부로 즐기실 수 있습니다.`,
        },
        healthyRecipes: [
          `[재료 변경] ${foodName} 조리 시 소금 대신 저염 양념이나 천연 향신료를 사용하면 나트륨 섭취를 줄일 수 있습니다`,
          `[조리법 변경] 튀기는 대신 굽거나 찌는 조리법을 선택하면 지방 섭취를 줄이고 영양소 손실을 최소화할 수 있습니다`,
          `[섭취 팁] 채소와 함께 섭취하면 식이섬유가 소화를 도와 영양 흡수를 개선합니다`,
          `[섭취 팁] 천천히 꼭꼭 씹어 드시면 소화에 도움이 되고 포만감도 오래 유지됩니다`,
          `[약 복용 시] 약 복용과 식사 시간을 1-2시간 간격으로 분리하면 약물 흡수에 영향을 줄일 수 있습니다`,
          `[섭취량 조절] 1회 섭취량을 적정 수준으로 유지하고 과식하지 않도록 주의하세요`,
        ],
      };
    }
  }

  /**
   * 복용 중인 모든 약물 간 상호작용 종합 분석
   */
  async analyzeAllDrugInteractions(drugDetails: any[]): Promise<{
    overallSafety: 'safe' | 'caution' | 'danger';
    overallScore: number;
    dangerousCombinations: Array<{
      drug1: string;
      drug2: string;
      interaction: string;
      recommendation: string;
    }>;
    cautionCombinations: Array<{
      drug1: string;
      drug2: string;
      interaction: string;
      recommendation: string;
    }>;
    synergisticEffects: Array<{
      drugs: string[];
      benefit: string;
      description: string;
    }>;
    summary: string;
    recommendations: string[];
  }> {
    try {
      const drugNames = drugDetails.map(d => d.name).join(', ');
      
      const prompt = `# Role Definition
당신은 20년 경력의 **'임상 약사(Clinical Pharmacist)'**입니다.
사용자가 복용 중인 모든 약물의 상호작용을 종합적으로 분석하여, **동시 복용의 안전성**을 평가하는 것이 목표입니다.

---

# Input Data
**복용 중인 약물 목록:** ${drugNames}

**약물 상세 정보 (공공데이터):**
${JSON.stringify(drugDetails, null, 2)}

---

# Analysis Logic

## Step 1. 약물 간 상호작용 탐지
각 약물 쌍을 분석하여:
- **위험한 조합 (Dangerous):** 동시 복용 시 심각한 부작용 가능
- **주의 필요 (Caution):** 복용 시간 조절 필요
- **긍정적 효과 (Synergy):** 함께 복용 시 치료 효과 증대

## Step 2. 전체 안전도 평가
- **safe:** 모든 약물이 안전하게 병용 가능
- **caution:** 일부 약물에서 주의 필요
- **danger:** 위험한 조합 존재, 즉시 의사 상담 필요

## Step 3. 종합 점수 산정 (0-100)
- 90-100: 매우 안전
- 70-89: 대체로 안전 (주의사항 준수)
- 40-69: 주의 필요 (복용 시간 조절 등)
- 0-39: 위험 (의사 상담 필수)

---

# Output Format
JSON 형식으로만 응답:

{
  "overallSafety": "safe" | "caution" | "danger",
  "overallScore": 85,
  "dangerousCombinations": [
    {
      "drug1": "약물A",
      "drug2": "약물B",
      "interaction": "구체적인 상호작용 메커니즘 (100자 이상)",
      "recommendation": "대처 방법 (예: 즉시 의사 상담, 복용 중단)"
    }
  ],
  "cautionCombinations": [
    {
      "drug1": "약물C",
      "drug2": "약물D",
      "interaction": "상호작용 설명",
      "recommendation": "복용 시간을 최소 2시간 간격으로 조절하세요"
    }
  ],
  "synergisticEffects": [
    {
      "drugs": ["약물E", "약물F"],
      "benefit": "혈압 조절 효과 증대",
      "description": "두 약물의 시너지 효과 설명 (50자 이상)"
    }
  ],
  "summary": "전체 약물 복용에 대한 종합 평가 (200자 이상). 안전성, 주의사항, 권장사항 포함",
  "recommendations": [
    "실용적인 복용 가이드 1 (예: 아침 식후 A약, 저녁 식후 B약)",
    "실용적인 복용 가이드 2",
    "실용적인 복용 가이드 3-5"
  ]
}

---

# Constraints
1. 제공된 공공데이터(식약처 e약은요, 낱알식별, 허가정보)를 근거로 분석
2. 상호작용 정보가 불확실하면 보수적으로 판단 (안전 우선)
3. 전문적이면서도 이해하기 쉬운 설명`;

      let rawText: string;
      try {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-pro', [ { text: prompt } ]);
      }
      
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('AI 약물 상호작용 분석 실패:', error);
      throw new Error(`AI drug interaction analysis failed: ${error.message}`);
    }
  }

  /**
   * AI가 의약품/건강기능식품 정보 생성 (API 한도 초과 또는 검색 실패 시 대체)
   * @param productName 제품명
   * @param numOfRows 생성할 결과 수
   */
  async generateMedicineInfo(productName: string, numOfRows: number = 5): Promise<any[]> {
    try {
      console.log(`[AI] 의약품/건강기능식품 정보 생성: ${productName}`);
      
      const prompt = `당신은 의약품 및 건강기능식품 전문가입니다.
사용자가 "${productName}"을(를) 검색했습니다.

이 제품과 관련된 의약품 또는 건강기능식품 정보를 ${Math.min(numOfRows, 5)}개 생성해주세요.
실제로 존재하는 제품명과 유사하게 생성하되, 정확한 정보를 제공해주세요.

다음 JSON 배열 형식으로 응답하세요:
[
  {
    "itemName": "정확한 제품명 (브랜드명 포함)",
    "entpName": "제조사명",
    "itemSeq": "고유번호",
    "efcyQesitm": "효능효과 (100자 이상 상세히)",
    "useMethodQesitm": "용법용량 (복용 방법, 횟수, 주의점 포함)",
    "atpnWarnQesitm": "경고 주의사항",
    "atpnQesitm": "일반 주의사항 (복용 시 주의할 점)",
    "intrcQesitm": "상호작용 (다른 약물/음식과의 상호작용)",
    "seQesitm": "이상반응 (부작용)",
    "depositMethodQesitm": "보관방법",
    "productType": "일반의약품|전문의약품|건강기능식품"
  }
]

# 규칙:
1. "${productName}"과 관련된 실제 존재하는 제품 정보를 기반으로 생성
2. 효능, 용법, 주의사항은 정확하고 상세하게 작성
3. 의약품이면 성분명도 포함
4. 건강기능식품이면 기능성 원료 포함
5. JSON 배열만 응답 (다른 텍스트 없이)`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
      }

      const parsed = this.extractJsonArray(rawText);
      
      if (parsed && parsed.length > 0) {
        // e약은요 형식으로 변환하여 반환
        return parsed.map((item: any, idx: number) => ({
          itemName: item.itemName || productName,
          entpName: item.entpName || 'AI 생성',
          itemSeq: item.itemSeq || `AI_${Date.now()}_${idx}`,
          efcyQesitm: item.efcyQesitm || '',
          useMethodQesitm: item.useMethodQesitm || '',
          atpnWarnQesitm: item.atpnWarnQesitm || '',
          atpnQesitm: item.atpnQesitm || '',
          intrcQesitm: item.intrcQesitm || '',
          seQesitm: item.seQesitm || '',
          depositMethodQesitm: item.depositMethodQesitm || '',
          itemImage: '',
          _isAIGenerated: true,
          _source: 'AI 생성 (Gemini)',
          _productType: item.productType || '정보 없음',
        }));
      }
      
      return [];
    } catch (error) {
      console.error('[AI] 의약품 정보 생성 실패:', error.message);
      return [];
    }
  }

  /**
   * AI가 건강기능식품 정보 생성 (API 검색 실패 시 대체)
   * 실제 존재하는 건강기능식품을 기반으로 정보 생성
   * @param keyword 검색 키워드 (예: 오메가3, 비타민D, 유산균)
   * @param numOfRows 생성할 결과 수
   */
  async generateHealthFoodInfo(keyword: string, numOfRows: number = 10): Promise<any[]> {
    try {
      console.log(`[AI] 건강기능식품 정보 생성: ${keyword}`);
      
      const prompt = `당신은 건강기능식품 전문가입니다.
사용자가 "${keyword}"을(를) 검색했습니다.

**중요: 실제로 한국에서 판매되고 있는 건강기능식품 제품을 기반으로 정보를 제공해주세요.**

"${keyword}"과 관련된 실제 건강기능식품 정보를 ${Math.min(numOfRows, 10)}개 생성해주세요.

다음 JSON 배열 형식으로 응답하세요:
[
  {
    "itemName": "실제 제품명 (브랜드명 + 제품명, 예: 종근당 오메가3)",
    "entpName": "제조사명 (예: 종근당건강, 뉴트리원, 안국건강)",
    "itemSeq": "고유번호",
    "efcyQesitm": "기능성 내용 (혈행 개선, 눈 건강 등 식약처 인정 기능성 포함)",
    "useMethodQesitm": "1일 섭취량, 섭취 방법, 섭취 시기 등",
    "atpnWarnQesitm": "경고 주의사항 (알레르기 등)",
    "atpnQesitm": "섭취 시 주의사항",
    "intrcQesitm": "의약품/음식과의 상호작용 주의사항",
    "seQesitm": "이상반응",
    "depositMethodQesitm": "보관방법",
    "rawMaterial": "주원료 (예: EPA, DHA, 비타민D, 프로바이오틱스 균주명)"
  }
]

# 규칙:
1. 실제 한국에서 판매되는 건강기능식품 브랜드/제품명 사용 (종근당, 안국건강, 뉴트리원, 대웅제약, 일양약품, 고려은단 등)
2. 식약처 인정 기능성 원료 및 기능성 내용 정확하게 기재
3. "${keyword}"과 관련된 다양한 제품 (다른 브랜드, 다른 성분 조합) 포함
4. 실제 섭취량 및 방법 기재 (예: 1일 1회 1캡슐)
5. JSON 배열만 응답 (다른 텍스트 없이)`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
      }

      const parsed = this.extractJsonArray(rawText);
      
      if (parsed && parsed.length > 0) {
        // e약은요 형식으로 변환하여 반환
        return parsed.map((item: any, idx: number) => ({
          itemName: item.itemName || keyword,
          entpName: item.entpName || 'AI 생성',
          itemSeq: item.itemSeq || `AI_HF_${Date.now()}_${idx}`,
          efcyQesitm: item.efcyQesitm || '',
          useMethodQesitm: item.useMethodQesitm || '',
          atpnWarnQesitm: item.atpnWarnQesitm || '',
          atpnQesitm: item.atpnQesitm || '',
          intrcQesitm: item.intrcQesitm || '',
          seQesitm: item.seQesitm || '',
          depositMethodQesitm: item.depositMethodQesitm || '',
          itemImage: '',
          _isAIGenerated: true,
          _isHealthFunctionalFood: true,
          _source: 'AI 생성 (Gemini)',
          _rawMaterial: item.rawMaterial || '',
        }));
      }
      
      return [];
    } catch (error) {
      console.error('[AI] 건강기능식품 정보 생성 실패:', error.message);
      return [];
    }
  }

  /**
   * AI가 제품 유형을 분류 (의약품 vs 건강기능식품)
   * @param keyword 검색 키워드
   * @returns 'medicine' | 'healthFood' | 'unknown'
   */
  async classifyProductType(keyword: string): Promise<'medicine' | 'healthFood' | 'unknown'> {
    try {
      console.log(`[AI] 제품 유형 분류: ${keyword}`);
      
      const prompt = `당신은 의약품과 건강기능식품을 분류하는 전문가입니다.

"${keyword}"이(가) 다음 중 어디에 해당하는지 판단해주세요:

1. **의약품 (medicine)**: 의사 처방이 필요한 전문의약품 또는 약국에서 구매하는 일반의약품
   - 예: 타이레놀, 아스피린, 콜킨, 콜키신, 가스터, 듀오덤, 무좀약, 감기약, 항생제, 진통제 등

2. **건강기능식품 (healthFood)**: 식약처 인증 건강기능식품, 영양제, 보충제
   - 예: 오메가3, 비타민, 유산균, 홍삼, 루테인, 프로바이오틱스, 글루코사민, 콜라겐 등

3. **알 수 없음 (unknown)**: 판단하기 어려운 경우

**중요**: 반드시 다음 중 하나만 응답하세요: medicine, healthFood, unknown

응답:`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text().trim().toLowerCase();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
        rawText = rawText.trim().toLowerCase();
      }

      console.log(`[AI] 제품 유형 분류 응답: ${rawText}`);
      
      if (rawText.includes('healthfood') || rawText.includes('health_food') || rawText.includes('건강기능식품')) {
        return 'healthFood';
      }
      if (rawText.includes('medicine') || rawText.includes('의약품')) {
        return 'medicine';
      }
      
      return 'unknown';
    } catch (error) {
      console.error('[AI] 제품 유형 분류 실패:', error.message);
      return 'unknown';
    }
  }

  /**
   * JSON 배열 추출 헬퍼
   */
  private extractJsonArray(raw: string): any[] {
    try {
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      
      // 배열 시작/끝 찾기
      const startIdx = cleaned.indexOf('[');
      const endIdx = cleaned.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = cleaned.substring(startIdx, endIdx + 1);
        return JSON.parse(jsonStr);
      }
      
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 🆕 약물/건강기능식품 성분 추출
   * 약물명과 효능 정보를 바탕으로 주요 성분(활성성분)을 추출
   */
  async extractMedicineComponents(
    itemName: string,
    efcyQesitm?: string,
    entpName?: string
  ): Promise<{
    components: Array<{ name: string; category: string; description: string }>;
    mainIngredient: string;
    drugClass: string;
  }> {
    try {
      const prompt = `당신은 약학 전문가입니다. 다음 의약품/건강기능식품의 주요 성분(활성성분)을 추출해주세요.

## 약품 정보
- 제품명: ${itemName}
- 제조사: ${entpName || '알 수 없음'}
- 효능/효과: ${efcyQesitm || '정보 없음'}

## 요청사항
1. 이 약품의 **주요 활성성분** 1~5개를 추출하세요
2. 각 성분의 약리학적 분류(카테고리)를 명시하세요
3. 성분별 간단한 설명을 추가하세요

## 응답 형식 (JSON)
\`\`\`json
{
  "mainIngredient": "주요 성분명 (예: 아세트아미노펜)",
  "drugClass": "약품 분류 (예: 해열진통제, 소화제, 비타민제 등)",
  "components": [
    {
      "name": "성분명 (한글)",
      "category": "분류 (예: NSAIDs, 비타민, 미네랄, 프로바이오틱스 등)",
      "description": "간단한 설명 (20자 이내)"
    }
  ]
}
\`\`\`

**중요**: 정확한 성분 정보를 알 수 없는 경우, 제품명/효능에서 유추되는 대표 성분을 제시하세요.
반드시 JSON 형식으로만 응답하세요.`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-flash', [ { text: prompt } ]);
      }

      const parsed = this.extractJsonObject(rawText);
      
      return {
        mainIngredient: parsed.mainIngredient || itemName,
        drugClass: parsed.drugClass || '일반의약품',
        components: parsed.components || [{ name: itemName, category: '알 수 없음', description: '성분 정보 없음' }],
      };
    } catch (error) {
      console.error('[AI] 약물 성분 추출 실패:', error.message);
      return {
        mainIngredient: itemName,
        drugClass: '알 수 없음',
        components: [{ name: itemName, category: '알 수 없음', description: '성분 추출 실패' }],
      };
    }
  }

  /**
   * 개별 약품 정보를 분석하고 보완 (공공데이터 불완전시 보충)
   * @param medicineName 약품명
   * @param publicData 공공데이터 (e약은요 API 결과)
   * @returns 분석된 약품 정보
   */
  async analyzeMedicineInfo(
    medicineName: string,
    publicData?: any
  ): Promise<{
    name: string;
    efficacy: string;
    usage: string;
    sideEffects: string;
    precautions: string;
    interactions: string;
    storageMethod: string;
    components: Array<{ name: string; description: string }>;
    dataCompleteness: 'complete' | 'partial' | 'ai_enhanced';
  }> {
    try {
      const publicDataStr = publicData ? JSON.stringify(publicData, null, 2) : '공공데이터 없음';

      const prompt = `당신은 의약품 정보 분석 및 보완 전문가입니다.

**중요 원칙:**
1. 공공데이터가 있으면 우선적으로 활용
2. 공공데이터가 없거나 불완전하면 전문 지식으로 보완 (단, 더미 데이터 생성 금지)
3. 정보를 생성할 수 없는 경우 "의료 전문가와 상담이 필요합니다" 메시지 제공

약품명: ${medicineName}

공공데이터 (e약은요 API):
${publicDataStr}

---

# 분석 및 보완 지침

1. **효능효과 (Efficacy)** - 100자 이상
   ✅ 공공데이터 있음 → 그대로 사용 또는 이해하기 쉽게 재정리
   ⚠️ 공공데이터 없음 → 약품명, 성분명, 약물 분류로 전문적으로 유추
   ❌ 정보 생성 불가 → "효능효과에 대한 정확한 정보는 의사 또는 약사와 상담하세요"

2. **용법용량 (Usage)** - 50자 이상
   ✅ 공공데이터 있음 → 그대로 사용
   ⚠️ 공공데이터 없음 → 약품 유형별 일반적 용법 제시 (예: "일반적으로 성인 1회 1정, 1일 3회 식후 복용")
   ❌ 정보 생성 불가 → "정확한 용법용량은 반드시 의사 또는 약사의 지시에 따르세요"

3. **이상반응/부작용 (Side Effects)** - 50자 이상
   ✅ 공공데이터 있음 → 주요 부작용 정리
   ⚠️ 공공데이터 없음 → 약물 분류별 일반적 부작용 나열
   ❌ 정보 생성 불가 → "부작용 정보는 의료 전문가와 상담이 필요합니다"

4. **주의사항 (Precautions)** - 50자 이상
   ✅ 공공데이터 있음 → 주요 주의사항 정리
   ⚠️ 공공데이터 없음 → 약물 분류별 기본 주의사항 제시
   ❌ 정보 생성 불가 → "복용 전 반드시 의사 또는 약사와 상담하세요"

5. **상호작용 (Interactions)** - 50자 이상
   ✅ 공공데이터 있음 → 주요 상호작용 정리
   ⚠️ 공공데이터 없음 → 약물 분류별 일반적 상호작용 제시 (예: "음주 시 주의", "특정 음식과 함께 복용 주의")
   ❌ 정보 생성 불가 → "다른 약물과의 상호작용은 의료 전문가에게 문의하세요"

6. **보관방법 (Storage)** - 30자 이상
   ✅ 공공데이터 있음 → 그대로 사용
   ⚠️ 공공데이터 없음 → 표준 보관법: "직사광선을 피하고 실온(15-30°C)의 건조한 곳에 보관하세요"

7. **주요 성분 (Components)** - 1개 이상
   ✅ 공공데이터/약품명에서 성분 추출 가능 → 성분과 역할 설명
   ⚠️ 성분 정보 없음 → 약품명 기반으로 유추 (예: "타이레놀" → "아세트아미노펜 (해열진통제)")
   ❌ 성분 추출 불가 → [{ "name": "${medicineName}", "description": "정확한 성분 정보는 제품 라벨 또는 약사 확인 필요" }]

---

# 데이터 완성도 판정
- **complete**: 공공데이터에서 모든 필드 완성 (보완 없음)
- **partial**: 공공데이터 일부만 제공, 일부 필드는 전문 지식으로 보완
- **ai_enhanced**: 공공데이터 없거나 매우 불완전, AI가 대부분 보완

---

# ⚠️ 중요 제약사항
1. **더미 데이터 생성 금지**: 불확실한 정보를 임의로 만들지 마세요
2. **전문가 확인 메시지 우선**: 정확한 정보를 제공할 수 없으면 "의료 전문가 상담 필요" 메시지 사용
3. **사실 기반 정보만**: 의학적 근거가 있는 정보만 제공

JSON 형식으로만 응답:

{
  "name": "${medicineName}",
  "efficacy": "효능효과 설명 (100자 이상) 또는 '의료 전문가 상담 필요' 메시지",
  "usage": "용법용량 설명 (50자 이상) 또는 '의료 전문가 상담 필요' 메시지",
  "sideEffects": "부작용 목록 (50자 이상, 쉼표 구분) 또는 '의료 전문가 상담 필요' 메시지",
  "precautions": "주의사항 목록 (50자 이상, 쉼표 구분) 또는 '의료 전문가 상담 필요' 메시지",
  "interactions": "상호작용 정보 (50자 이상, 쉼표 구분) 또는 '의료 전문가 상담 필요' 메시지",
  "storageMethod": "보관방법 (30자 이상)",
  "components": [
    { "name": "성분명", "description": "역할 설명" }
  ],
  "dataCompleteness": "complete" | "partial" | "ai_enhanced"
}`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi('gemini-2.5-flash', [{ text: prompt }]);
      }

      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error('[AI] 약품 정보 분석 실패:', error.message);
      return {
        name: medicineName,
        efficacy: '정보 없음',
        usage: '정보 없음',
        sideEffects: '정보 없음',
        precautions: '정보 없음',
        interactions: '정보 없음',
        storageMethod: '정보 없음',
        components: [],
        dataCompleteness: 'partial',
      };
    }
  }

  /**
   * 여러 약품의 정보를 일괄 분석
   * @param medicines 약품 목록 (name, publicData 포함)
   * @returns 분석된 약품 정보 배열
   */
  async analyzeMedicineInfoBatch(
    medicines: Array<{ name: string; publicData?: any }>
  ): Promise<Array<{
    name: string;
    efficacy: string;
    usage: string;
    sideEffects: string;
    precautions: string;
    interactions: string;
    storageMethod: string;
    components: Array<{ name: string; description: string }>;
    dataCompleteness: 'complete' | 'partial' | 'ai_enhanced';
  }>> {
    console.log(`[AI] ${medicines.length}개 약품 일괄 분석 시작...`);

    const results = await Promise.all(
      medicines.map((med) =>
        this.analyzeMedicineInfo(med.name, med.publicData).catch((err) => {
          console.warn(`[AI] ${med.name} 분석 실패:`, err.message);
          return {
            name: med.name,
            efficacy: '정보 없음',
            usage: '정보 없음',
            sideEffects: '정보 없음',
            precautions: '정보 없음',
            interactions: '정보 없음',
            storageMethod: '정보 없음',
            components: [],
            dataCompleteness: 'partial' as const,
          };
        })
      )
    );

    console.log(`[AI] ${medicines.length}개 약품 분석 완료`);
    return results;
  }
}



