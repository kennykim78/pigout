import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

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
    this.visionModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
    this.textModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
    // [Cost Optimization] 'proModel' 변수는 유지하되, 실제 모델은 'gemini-2.5-flash'를 연결하여 비용 절감
    this.proModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // 백업 API 키 설정 (메인 키가 무효하면 백업 키를 메인으로 사용)
    const backupKey = process.env.GEMINI_API_KEY_BACKUP;
    if (backupKey) {
      this.genAIBackup = new GoogleGenerativeAI(backupKey);
      console.log("[Gemini] 백업 API 키가 설정되었습니다.");
    }
  }

  // Rate limiting: 요청 간 최소 간격 보장
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[Gemini] Rate limiting: ${waitTime}ms 대기 중...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private getBaseUrl(): string {
    // Use v1beta for gemini-2.5-pro/flash models (required for proper quota management)
    return (
      process.env.GEMINI_API_BASE?.trim() ||
      "https://generativelanguage.googleapis.com/v1beta"
    );
  }

  private getCurrentApiKey(): string {
    if (this.useBackupKey && process.env.GEMINI_API_KEY_BACKUP) {
      return process.env.GEMINI_API_KEY_BACKUP;
    }
    return process.env.GEMINI_API_KEY || "";
  }

  private switchToBackupKey(): boolean {
    if (!this.useBackupKey && process.env.GEMINI_API_KEY_BACKUP) {
      this.useBackupKey = true;
      console.log("[Gemini] 🔄 백업 API 키로 전환합니다.");
      // 백업 키로 모델 재설정
      if (this.genAIBackup) {
        this.visionModel = this.genAIBackup.getGenerativeModel({
          model: "gemini-2.5-flash",
        });
        this.textModel = this.genAIBackup.getGenerativeModel({
          model: "gemini-2.5-flash",
        });
        this.proModel = this.genAIBackup.getGenerativeModel({
          model: "gemini-2.5-pro",
        });
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
    if (!key) throw new Error("GEMINI_API_KEY not set");
    const url = `${this.getBaseUrl()}/models/${model}:generateContent?key=${key}`;
    const body = { contents: [{ parts }] };
    const resp = await axios.post(url, body, { timeout: 30000 });
    const data: GenerateContentResponse = resp.data;
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "";
    return text;
  }

  public extractJsonObject(raw: string): any {
    // Remove markdown code blocks if present
    let cleaned = raw.trim();
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "");

    // Try to find JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in model response");
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      throw new Error("Failed to parse JSON: " + (e as Error).message);
    }
  }

  public async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.textModel.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      // Fallback to REST API if SDK fails (using existing logic pattern)
      console.warn("SDK failed, trying REST API for generateText");
      return await this.callWithRestApi("gemini-2.5-flash", [{ text: prompt }]);
    }
  }

  async analyzeImageForFood(
    imageBase64: string,
    retries = 2
  ): Promise<{
    isValid: boolean;
    category: "food" | "medicine" | "supplement" | "invalid";
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
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
          ]);
          const response = await result.response;
          rawText = response.text();
        } catch (sdkError) {
          console.log(
            `Vision SDK 오류, REST API 시도 (${attempt + 1}/${retries + 1}):`,
            sdkError.message
          );
          // Fallback: direct v1 REST
          rawText = await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
          ]);
        }

        const parsed = this.extractJsonObject(rawText);
        return parsed;
      } catch (error) {
        lastError = error;
        console.error(
          `Gemini 이미지 분석 실패 (시도 ${attempt + 1}/${retries + 1}):`,
          error.message
        );

        if (attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`${waitTime}ms 후 재시도...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // 모든 재시도 실패 시 에러
    throw new Error(
      `Gemini image analysis failed after ${retries + 1} attempts: ${
        lastError?.message
      }`
    );
  }

  /**
   * 약품 이미지 분석 (약 봉지, 약품, 알약 등)
   * OCR + 약품 형태 인식으로 약품명 추출
   * @param imageBase64 이미지 Base64 데이터
   * @returns 인식된 약품 목록
   */
  async analyzeMedicineImage(
    imageBase64: string,
    retries = 2
  ): Promise<{
    success: boolean;
    medicines: Array<{
      name: string; // 약품명
      manufacturer?: string; // 제조사 (인식된 경우)
      dosage?: string; // 용량 (인식된 경우)
      shape?: string; // 약품 형태 (정제, 캡슐, 시럽 등)
      color?: string; // 색상
      imprint?: string; // 각인 문자
      confidence: number; // 인식 신뢰도 (0-100)
    }>;
    totalCount: number;
    imageType:
      | "prescription_bag"
      | "pill_package"
      | "loose_pills"
      | "medicine_bottle"
      | "unknown";
    rawText?: string; // OCR로 인식된 전체 텍스트
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
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
          ]);
          const response = await result.response;
          rawText = response.text();
        } catch (sdkError) {
          console.log(
            `[약품 이미지 분석] SDK 오류, REST API 시도 (${attempt + 1}/${
              retries + 1
            }):`,
            sdkError.message
          );
          // Fallback: direct v1 REST
          rawText = await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
          ]);
        }

        const parsed = this.extractJsonObject(rawText);
        console.log(
          `[약품 이미지 분석] 성공: ${parsed.totalCount}개 약품 인식`
        );
        return parsed;
      } catch (error) {
        lastError = error;
        console.error(
          `[약품 이미지 분석] 실패 (시도 ${attempt + 1}/${retries + 1}):`,
          error.message
        );

        if (attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`${waitTime}ms 후 재시도...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // 모든 재시도 실패 시 기본 응답
    console.error(`[약품 이미지 분석] 모든 시도 실패: ${lastError?.message}`);
    return {
      success: false,
      medicines: [],
      totalCount: 0,
      imageType: "unknown",
      message: "이미지 분석에 실패했습니다. 다시 시도해주세요.",
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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }
      const parsed = this.extractJsonObject(rawText);
      return parsed.foodName;
    } catch (error) {
      console.error("Gemini text extraction error:", error);
      throw new Error(`Gemini text extraction failed: ${error.message}`);
    }
  }

  async analyzeFoodSuitability(
    foodName: string,
    diseases: string[],
    nutritionData?: any,
    publicData?: any,
    cachedGeneralInfo?: any // [New] 캐시된 일반 분석 정보
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
        const diseaseList = diseases.length > 0 ? diseases.join(", ") : "없음";
        const nutritionInfo = nutritionData
          ? JSON.stringify(nutritionData, null, 2)
          : "영양 정보 없음";

        const publicDataInfo = publicData
          ? JSON.stringify(publicData, null, 2)
          : "공공데이터 없음";

        // [Smart Cache] 캐시된 일반 정보가 있으면 프롬프트에 주입하여 토큰 절약 & 일관성 확보
        let cacheContext = "";
        if (cachedGeneralInfo) {
          cacheContext = `
[기존 분석 데이터 (활용 필수)]:
- 일반적 효능: ${JSON.stringify(cachedGeneralInfo.general_benefit)}
- 일반적 부작용: ${JSON.stringify(cachedGeneralInfo.general_harm)}
- 영양 요약: ${JSON.stringify(cachedGeneralInfo.nutrition_summary)}
(위 데이터를 바탕으로 사용자의 질병(${diseaseList})에 맞게 재구성하세요. 새로운 사실을 지어내지 마세요.)
`;
        }

        const prompt = `당신은 영양 및 질병 관리 전문가입니다.

음식: ${foodName}
질병: ${diseaseList}
영양정보: ${nutritionInfo}

공공데이터 (식품의약품안전처):
${publicDataInfo}
${cacheContext}

위의 데이터를 참고하여 다음을 상세히 분석하세요:

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
          console.log(
            `SDK 오류, REST API로 재시도 (시도 ${attempt + 1}/${
              maxRetries + 1
            })...`
          );
          rawText = await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
          ]);
        }
        return this.extractJsonObject(rawText);
      } catch (error) {
        lastError = error;
        console.error(
          `Gemini 분석 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`,
          error.message
        );

        if (attempt < maxRetries) {
          // 재시도 전 대기 (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`${waitTime}ms 후 재시도...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // 모든 재시도 실패 시 기본값 반환
    console.warn("Gemini API 호출 실패, 기본 분석 반환");
    return {
      suitabilityScore: 65,
      pros: [
        `${foodName}은(는) 적절히 섭취하면 영양소를 공급할 수 있습니다.`,
        "다양한 식재료와 함께 드시면 영양 균형을 맞출 수 있습니다.",
      ],
      cons:
        diseases.length > 0
          ? [
              `${diseases.join(
                ", "
              )} 질환이 있으시다면 섭취량에 주의가 필요합니다.`,
              "과도한 섭취는 피하시는 것이 좋습니다.",
            ]
          : [
              "과도한 섭취는 피하시는 것이 좋습니다.",
              "균형잡힌 식단의 일부로 섭취하세요.",
            ],
      summary: `${foodName}은(는) 균형있게 섭취하시면 좋습니다.`,
      cookingTips: [
        "신선한 재료를 사용하세요",
        "조리 시 염분과 당분을 적게 사용하세요",
        "채소를 많이 추가하면 더 건강해요",
      ],
      dataSources: [],
      riskComponents: {},
    };
  }

  /**
   * 공공데이터 없이 순수 AI 지식만으로 빠른 분석 수행
   * Result01용 - 간략한 정보만 제공 (각 항목 1줄씩)
   * 🆕 enhancedMedicineInfo 추가: 토큰 절약을 위한 미리 생성된 약 정보
   */
  async quickAIAnalysis(
    foodName: string,
    diseases: string[],
    medicines: string[] = [],
    enhancedMedicineInfo?: Array<{
      name: string;
      category: string;
      foodInteractions: { avoid: string[]; caution: string[] };
    }>,
    diseaseEnhancedInfo?: Array<{
      disease_name: string;
      category: string;
      severity: string;
      avoid_foods: string[];
      caution_foods: string[];
      dietary_reason: string;
    }>,
    userProfile?: { age?: number; gender?: string }
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
        // 🆕 질병 강화 정보가 있으면 활용, 없으면 기존 방식 (질병 이름만)
        let diseaseInfo = "";
        if (diseaseEnhancedInfo && diseaseEnhancedInfo.length > 0) {
          diseaseInfo = diseaseEnhancedInfo
            .map((d) => {
              const avoid =
                d.avoid_foods.length > 0
                  ? `피할음식: ${d.avoid_foods.slice(0, 3).join(", ")}`
                  : "";
              const caution =
                d.caution_foods.length > 0
                  ? `주의음식: ${d.caution_foods.slice(0, 3).join(", ")}`
                  : "";
              return `${d.disease_name}(${d.category}, ${d.severity}) ${avoid} ${caution}`.trim();
            })
            .join(" | ");
        } else {
          diseaseInfo = diseases.length > 0 ? diseases.join(", ") : "없음";
        }

        // 🆕 약 강화 정보가 있으면 활용, 없으면 기존 방식 (약 이름만)
        let medicineInfo = "";
        if (enhancedMedicineInfo && enhancedMedicineInfo.length > 0) {
          medicineInfo = enhancedMedicineInfo
            .map((m) => {
              const avoid =
                m.foodInteractions.avoid.length > 0
                  ? `금기: ${m.foodInteractions.avoid.join(", ")}`
                  : "";
              const caution =
                m.foodInteractions.caution.length > 0
                  ? `주의: ${m.foodInteractions.caution.join(", ")}`
                  : "";
              return `${m.name}(${m.category}) ${avoid} ${caution}`.trim();
            })
            .join(" | ");
        } else {
          medicineInfo = medicines.length > 0 ? medicines.join(", ") : "없음";
        }

        // 🆕 환자 정보 추가
        let patientInfo = "";
        if (userProfile && userProfile.age && userProfile.gender) {
          const genderKo = userProfile.gender === "male" ? "남성" : "여성";
          const ageGroup =
            userProfile.age < 18
              ? "소아/청소년"
              : userProfile.age >= 65
              ? "고령자"
              : "성인";
          patientInfo = `\n환자 정보: ${userProfile.age}세, ${genderKo} (${ageGroup})`;
        }

        const prompt = `당신은 Pigout AI입니다. 임상 약학, 영양학, 공공데이터를 종합하여 분석합니다.
빠르고 간결하게 분석해주세요.${patientInfo}

【환자 정보】
- 음식: ${foodName}
- 질병: ${diseaseInfo}
- 복용 약: ${medicineInfo}

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
          console.log(
            `quickAIAnalysis SDK 오류, REST API로 재시도 (시도 ${attempt + 1}/${
              maxRetries + 1
            })...`
          );
          rawText = await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
          ]);
        }

        const parsed = this.extractJsonObject(rawText);
        console.log("[quickAIAnalysis] 분석 완료:", {
          score: parsed.suitabilityScore,
          food: foodName,
        });
        return parsed;
      } catch (error) {
        lastError = error;
        console.error(
          `quickAIAnalysis 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`,
          error.message
        );

        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // 실패 시 기본값
    console.warn("quickAIAnalysis 실패, 기본값 반환");
    return {
      suitabilityScore: 60,
      pros: `${foodName}은(는) 적절히 섭취하면 영양을 공급합니다`,
      cons: "과다 섭취는 피하시는 것이 좋습니다",
      summary: `${foodName}은(는) 적당량 섭취를 권장합니다`,
      warnings:
        diseases.length > 0
          ? `${diseases[0]} 환자는 섭취량 조절이 필요합니다`
          : "",
      expertAdvice: "균형 잡힌 식단의 일부로 섭취하세요",
    };
  }

  async generateDetailedAnalysis(
    foodName: string,
    diseases: string[],
    nutritionData?: any
  ): Promise<{
    pros: string[];
    cons: string[];
    nutrition: {
      calories: number;
      summary: string;
      highlight: string;
    };
    recipe: {
      substitutes: string;
      cookingMethod: string;
      intakeGuide: string;
      searchKeyword: string;
    };
    alternatives: Array<{ name: string; reason: string }>;
    summary: string;
  }> {
    try {
      const diseaseList = diseases.join(", ");
      const nutritionInfo = nutritionData
        ? JSON.stringify(nutritionData)
        : "영양 정보 없음";

      const prompt = `당신은 세계적인 임상 영양학 전문가입니다.
사용자 맞춤형 정밀 분석을 수행하고, 결과를 **극도로 간결하고 직관적인 데이터**로 제공하세요.

음식: ${foodName}
질병: ${diseaseList}
영양정보 Context: ${nutritionInfo}

다음 요구사항에 맞춰 엄격한 JSON 형식으로 응답하세요. (서술형 금지, 단어/구 단위 작성)

1. **pros (장점)**: 사용자의 건강/질병에 도움이 되는 핵심 장점 4~5개를 '단어' 또는 '짧은 구' 형태의 태그로 작성.
   - 예: ["근육 형성", "고단백", "활력 증진", "빈혈 예방"]

2. **cons (단점/주의)**: 주의해야 할 점 4~5개를 '단어' 또는 '짧은 구' 형태의 태그로 작성.
   - 예: ["나트륨 주의", "높은 칼로리", "산성 성분"]

3. **nutrition (영양 정보)**:
   - calories: 1인분 대략적 칼로리 (숫자만, 예: 350)
   - summary: 영양 구성 한 줄 요약 (예: "탄수화물 위주의 고열량 식단입니다.")
   - highlight: 가장 돋보이는 영양 성분 1가지 (예: "비타민 D 풍부")

4. **recipe (스마트 레시피)**:
   - substitutes: 건강을 위한 재료 대체 팁 (1줄) (예: "설탕 대신 알룰로스 사용 권장")
   - cookingMethod: 건강한 조리법 핵심 (1줄) (예: "기름에 튀기지 않고 에어프라이어 조리")
   - intakeGuide: 섭취 방법 가이드 (1줄) (예: "국물은 남기고 건더기 위주로 섭취")
   - searchKeyword: YouTube에서 레시피 검색을 위한 최적 키워드 (예: "저염식 ${foodName} 레시피")

5. **alternatives (대체 음식 추천)**: 상세 분석 결과, 이 음식이 부담스러울 경우 선택할 수 있는 더 건강한 대체 음식 3가지.
   - name: 대체 음식 이름
   - reason: 추천 이유 (간결하게 10자 내외) (예: "나트륨이 50% 적음")

6. **summary**: 전체 종합 분석 (기존 서술형 유지, 3문장 내외로 전문적인 조언)

JSON 포맷:
{
  "pros": ["태그1", "태그2", ...],
  "cons": ["태그1", "태그2", ...],
  "nutrition": {
    "calories": 0,
    "summary": "...",
    "highlight": "..."
  },
  "recipe": {
    "substitutes": "...",
    "cookingMethod": "...",
    "intakeGuide": "...",
    "searchKeyword": "..."
  },
  "alternatives": [
    { "name": "...", "reason": "..." },
    { "name": "...", "reason": "..." },
    { "name": "...", "reason": "..." }
  ],
  "summary": "..."
}`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }
      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error("Gemini detailed analysis error:", error);
      throw new Error(`Gemini detailed analysis failed: ${error.message}`);
    }
  }

  async urlToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      const base64 = Buffer.from(response.data, "binary").toString("base64");
      return base64;
    } catch (error) {
      console.error("URL to base64 conversion error:", error);
      throw new Error(`Failed to convert URL to base64: ${error.message}`);
    }
  }

  /**
   * 일반 음식 분석 요청 (사용자 Context 제외)
   * 캐싱용으로 사용됨 - 음식의 일반적인 효능, 부작용, 조리법 등
   */
  async generateGeneralFoodInfo(
    foodName: string,
    nutritionData?: any
  ): Promise<{
    general_benefit: string[];
    general_harm: string[];
    cooking_tips: string[];
    nutrition_summary: string;
  }> {
    const nutritionInfo = nutritionData
      ? JSON.stringify(nutritionData, null, 2)
      : "정보 없음";

    const prompt = `
    당신은 영양학 전문가입니다.
    대상 음식: "${foodName}"
    영양 정보: ${nutritionInfo}

    다음 항목을 분석하여 JSON으로 제공하세요. 이 분석은 특정 질병이 없는 '일반인' 기준입니다.

    1. general_benefit: 영양학적 장점/효능 (3~4가지, 배열)
    2. general_harm: 일반적인 주의사항/부작용 (과다 섭취 시 문제 등) (2~3가지, 배열)
    3. cooking_tips: 건강한 조리법 팁 (3가지, 배열)
    4. nutrition_summary: 영양 성분 요약 (1줄)

    JSON 응답:
    {
        "general_benefit": [],
        "general_harm": [],
        "cooking_tips": [],
        "nutrition_summary": ""
    }
    `;

    try {
      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const parsed = this.extractJsonObject(rawText);
      return parsed;
    } catch (error) {
      console.error("General food info generation failed:", error);
      // 기본값 반환
      return {
        general_benefit: [`${foodName}은(는) 영양가 있는 음식입니다.`],
        general_harm: ["과다 섭취는 피하세요."],
        cooking_tips: [],
        nutrition_summary: "영양 정보 분석 불가",
      };
    }
  }

  /**
   * 의학적 분석 수행 (RAG 기반 프롬프트)
   */
  async generateMedicalAnalysis(prompt: string): Promise<any> {
    try {
      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const jsonResult = this.extractJsonObject(rawText);

      // 점수가 없으면 기본값 설정
      if (!jsonResult.final_score) {
        jsonResult.final_score = this.calculateScoreFromLevel(
          jsonResult.interaction_assessment?.level || "insufficient_data"
        );
      }

      return jsonResult;
    } catch (error) {
      console.error("Gemini medical analysis error:", error);
      throw new Error(`Gemini medical analysis failed: ${error.message}`);
    }
  }

  /**
   * 상호작용 레벨에서 점수 계산
   */
  private calculateScoreFromLevel(level: string): number {
    const scoreMap = {
      safe: 90,
      caution: 70,
      danger: 40,
      insufficient_data: 65,
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
        const isRateLimitError =
          status === 429 || error.message?.includes("429");

        // 에러 메시지 분석
        const errorMsg = error.message || "";
        const isQuotaExceeded =
          errorMsg.includes("quota") || errorMsg.includes("limit: 0");
        const isPerMinuteLimit = errorMsg.includes("PerMinute");
        const isPerDayLimit = errorMsg.includes("PerDay");
        const isAuthError =
          status === 401 ||
          status === 403 ||
          errorMsg.includes("API key") ||
          errorMsg.includes("PERMISSION");

        // 인증/권한 오류 발생 시 백업 키로 전환 시도 (한 번만)
        if (
          isAuthError &&
          !this.useBackupKey &&
          process.env.GEMINI_API_KEY_BACKUP
        ) {
          console.warn(
            `[Gemini] 인증/권한 오류 감지 (status=${status}) - 백업 키로 전환 시도`
          );
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
        if (
          isRateLimitError &&
          isQuotaExceeded &&
          !this.useBackupKey &&
          attempt === 0
        ) {
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
        if (isQuotaExceeded && errorMsg.includes("limit: 0")) {
          console.warn(`[Gemini] 할당량 완전 소진(limit: 0) - 즉시 에러 발생`);
          throw error;
        }

        // 분당 요청 제한만 재시도 (1회)
        if (isRateLimitError && isPerMinuteLimit && attempt < maxRetries) {
          const delay = 2000 + Math.random() * 1000; // 2-3초
          console.warn(
            `[Gemini] 분당 요청 제한 – ${delay.toFixed(0)}ms 후 재시도 (${
              attempt + 1
            }/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 일일 할당량은 재시도하지 않음 (내일까지 대기 필요)
        if (isPerDayLimit) {
          console.warn(`[Gemini] 일일 할당량 한계 - 내일 재시도 필요`);
          throw error;
        }

        console.warn(
          `[Gemini] 요청 실패: status=${status}, attempt=${attempt}, msg=${errorMsg.substring(
            0,
            100
          )}`
        );
        throw error;
      }
    }
    throw new Error("Max retries exceeded");
  }

  async analyzeFoodComponents(
    foodName: string,
    diseases: string[],
    publicDatasets?: {
      nutrition?: any;
      healthFunctionalFoods?: any;
      diseaseInfo?: any;
    },
    userProfile?: { age?: number; gender?: string }
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
      const diseaseList = diseases.length > 0 ? diseases.join(", ") : "없음";

      // 🆕 공개데이터 다이제스트 (전체가 아닌 필요한 부분만)
      let nutritionSummary = "데이터 없음";
      if (
        publicDatasets?.nutrition?.items &&
        Array.isArray(publicDatasets.nutrition.items)
      ) {
        const item = publicDatasets.nutrition.items[0];
        if (item) {
          const calories = item.AMT_NUM1 || "정보 없음";
          const protein = item.AMT_NUM3 || "정보 없음";
          const fat = item.AMT_NUM4 || "정보 없음";
          const carbs = item.AMT_NUM5 || "정보 없음";
          const sodium = item.AMT_NUM13 || "정보 없음";
          const foodName = item.FOOD_NM_KR || "음식";

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
      rawText = await this.callWithRetry(async () => {
        const result = await this.proModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
      }, 4);

      const parsed = this.extractJsonObject(rawText);
      return {
        ...parsed,
        referenceData: publicDatasets,
      };
    } catch (error) {
      console.error("AI 음식 성분 분석 실패:", error);
      throw new Error(`AI food component analysis failed: ${error.message}`);
    }
  }

  /**
   * [4단계] AI가 음식 성분과 약물 공공데이터를 직접 비교하여 상호작용 판단
   */
  async analyzeDrugFoodInteractions(
    foodName: string,
    foodAnalysis: any,
    drugDetails: Array<{
      name: string;
      analyzedInfo?: any;
      publicData?: any;
      enhancedInfo?: any;
    }>,
    diseases: string[],
    userProfile?: { age?: number; gender?: string }
  ): Promise<{
    interactions: Array<{
      medicine_name: string;
      risk_level: "danger" | "caution" | "safe";
      interaction_description: string;
      evidence_from_public_data: string;
      recommendation: string;
      medicines?: string[]; // 최소 크기 배열 [medicine_name]
      food_components?: string[]; // 필요한 성분만 포함 (리스크 카드용)
    }>;
    summary: string;
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(", ") : "없음";
      const profileInfo = userProfile
        ? `${userProfile.age}세 ${
            userProfile.gender === "male"
              ? "남성"
              : userProfile.gender === "female"
              ? "여성"
              : ""
          }`
        : "정보 없음";
      const components = foodAnalysis.components || [];
      const riskFactors = foodAnalysis.riskFactors || {};

      // 약품 정보를 요약 형식으로 변환 (캐시된 AI 분석 우선 사용)
      const medicinesSummary = drugDetails.map((drug) => {
        if (drug.analyzedInfo) {
          // 등록 시 저장된 AI 분석 사용 (이미 요약됨)
          return {
            name: drug.name,
            efficacy: drug.analyzedInfo.efficacy || "정보 없음",
            usage: drug.analyzedInfo.usage || "정보 없음",
            sideEffects: drug.analyzedInfo.sideEffects || "정보 없음",
            precautions: drug.analyzedInfo.precautions || "정보 없음",
            interactions: drug.analyzedInfo.interactions || "정보 없음",
            components: drug.analyzedInfo.components || [],
          };
        } else if (drug.publicData) {
          // 공공데이터 요약 (필수 필드만)
          return {
            name: drug.name,
            efficacy: drug.publicData.efcyQesitm
              ? drug.publicData.efcyQesitm.substring(0, 200) + "..."
              : "정보 없음",
            precautions: drug.publicData.atpnQesitm
              ? drug.publicData.atpnQesitm.substring(0, 150) + "..."
              : "정보 없음",
            interactions: drug.publicData.intrcQesitm
              ? drug.publicData.intrcQesitm.substring(0, 150) + "..."
              : "정보 없음",
            sideEffects: drug.publicData.seQesitm
              ? drug.publicData.seQesitm.substring(0, 100) + "..."
              : "정보 없음",
          };
        } else {
          return { name: drug.name, note: "AI 분석 필요" };
        }
      });

      const prompt = `# 약물-음식 상호작용 분석

**입력 데이터:**
음식: ${foodName} | 질병: ${diseaseList} | 사용자: ${profileInfo}

**음식 성분:**
${components.map((c) => c.name).join(", ")}

**복용 약물 (요약):**
${medicinesSummary
  .map((m) => `${m.name}: ${m.interactions || m.precautions || "정보 요약 중"}`)
  .join("\n")}

**분석 규칙 (토큰 최적화):**
1. 각 약물별로 위험도 판정 (danger/caution/safe)
2. interaction_description: 40-60자, 음식 성분 중심 설명
3. evidence_from_public_data: 약물 정보 근거 또는 "의학 지식 기반"
4. recommendation: 30-50자, 구체적 행동 지침
5. medicines: 단일 원소 배열로 [약물명] 추가 (리스크 카드용)
6. food_components: 이 상호작용에 관련된 성분명만 배열로 포함 (필요 최소)

**출력 JSON:**
{
  "interactions": [
    {
      "medicine_name": "타이레놀",
      "risk_level": "danger",
      "medicines": ["타이레놀"],
      "food_components": ["알코올"],
      "interaction_description": "알코올과 타이레놀 동시 섭취 시 간 손상 위험 증가",
      "evidence_from_public_data": "약물 주의사항: 음주 시 간 손상 위험",
      "recommendation": "음주 후 6시간 간격 유지, 당일 복용 금지"
    }
  ],
  "summary": "${drugDetails.length}개 약물 분석 완료"
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
        if (sdkError.message?.includes("429") || sdkError.status === 429) {
          console.warn(
            "[analyzeDrugFoodInteractions] 429 에러 - 안전 기본 응답 반환"
          );
          return {
            interactions: drugDetails.map((drug) => ({
              medicine_name: drug.name,
              risk_level: "caution",
              medicines: [drug.name],
              food_components: [],
              interaction_description: `이 음식과 ${drug.name}의 상호작용을 AI로 분석하지 못했습니다. 안전을 위해 의료 전문가와 상담하세요.`,
              evidence_from_public_data:
                "AI 분석 일시 불가 - 보수적 권장 사항 제공",
              recommendation:
                "복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 약사 또는 의사와 상담하세요.",
            })),
            summary: `${drugDetails.length}개 약물 모두 보수적 주의 권장 - 상세 상담 필요`,
          };
        }

        console.warn(
          "[analyzeDrugFoodInteractions] SDK 실패, REST API로 폴백:",
          sdkError.message
        );
        try {
          rawText = await this.callWithRetry(async () => {
            return await this.callWithRestApi("gemini-2.5-flash", [
              { text: prompt },
            ]);
          });
        } catch (v1Error: any) {
          // V1도 실패 시 기본 안전 응답
          if (v1Error.message?.includes("429") || v1Error.status === 429) {
            console.warn(
              "[analyzeDrugFoodInteractions] V1도 429 에러 - 안전 기본 응답 반환"
            );
            return {
              interactions: drugDetails.map((drug) => ({
                medicine_name: drug.name,
                risk_level: "caution",
                medicines: [drug.name],
                food_components: [],
                interaction_description: `이 음식과 ${drug.name}의 상호작용을 AI로 분석하지 못했습니다. 안전을 위해 의료 전문가와 상담하세요.`,
                evidence_from_public_data:
                  "AI 분석 일시 불가 - 보수적 권장 사항 제공",
                recommendation:
                  "복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 약사 또는 의사와 상담하세요.",
              })),
              summary: `${drugDetails.length}개 약물 모두 보수적 주의 권장 - 상세 상담 필요`,
            };
          }
          throw v1Error;
        }
      }

      const parsed = this.extractJsonObject(rawText);

      // 리스크 카드용 최소 필드만 유지 (토큰 절감)
      const interactions = (parsed.interactions || []).map(
        (interaction: any) => ({
          medicine_name: interaction.medicine_name,
          risk_level: interaction.risk_level,
          interaction_description: interaction.interaction_description,
          evidence_from_public_data: interaction.evidence_from_public_data,
          recommendation: interaction.recommendation,
          medicines: interaction.medicines || [interaction.medicine_name],
          food_components: interaction.food_components || [],
        })
      );

      return {
        interactions,
        summary: parsed.summary || `${drugDetails.length}개 약물 분석 완료`,
      };
    } catch (error) {
      console.error("AI 약물-음식 상호작용 분석 실패:", error);
      // 최후의 fallback - 모든 약물에 대해 caution 반환
      return {
        interactions: drugDetails.map((drug) => ({
          medicine_name: drug.name,
          risk_level: "caution",
          medicines: [drug.name],
          food_components: [],
          interaction_description: `이 음식과 ${drug.name}의 상호작용을 분석할 수 없습니다. 안전을 위해 의료 전문가와 상담해주세요.`,
          evidence_from_public_data: "분석 불가 - 보수적 권장 사항 제공",
          recommendation:
            "복용 시간과 식사 시간을 1-2시간 간격으로 분리하고, 약사 또는 의사와 상담하세요.",
        })),
        summary: `${drugDetails.length}개 약물 모두 보수적 주의 권장 - 전문가 상담 필수`,
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
      const diseaseList = diseases.length > 0 ? diseases.join(", ") : "없음";
      const drugList =
        interactionAnalysis?.interactions
          ?.map((i: any) => i.medicine_name)
          .join(", ") || "없음";

      const prompt = `# Role Definition
당신은 **Pigout AI**입니다. 임상 약학, 영양학 전문지식과 식품의약품안전처 등 공공데이터를 종합 분석하여 사용자에게 **근거 중심(Evidence-based)**의 정밀 분석 리포트를 제공합니다.

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

5. **expertAdvice** (문자열): 🤖 Pigout AI 분석 결과
   - 친근하고 따뜻한 어조로 2-3문장
   - 실용적인 섭취 가이드 포함
   - 100자 이상

6. **briefSummary** (문자열): 간단 요약 (2-3줄, 80자 내외)
   - 장점/단점/위험/조리법 나열하지 말 것
   - 사용자의 질병과 연관지어 **위트있고 친근한 말투**로 작성
   - 마치 친한 의사 친구가 한마디 해주는 것처럼
   - 예: "고혈압이시라면 국물은 살짝 남기시는 게 좋겠어요. 그래도 단백질 보충엔 딱이죠!"

7. **summary** (문자열): 🔬 Pigout AI 종합 분석
   - 약물/음식 분석 + 공공데이터 기반 종합 평가
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
  "expertAdvice": "🤖 Pigout AI 분석 결과: 이 음식은 영양가가 높지만, 복용 중인 약물을 고려하여 식후 2시간 뒤에 드시는 것을 권장합니다. 국물보다는 건더기 위주로 드시면 나트륨 섭취를 줄일 수 있어요.",
  "briefSummary": "고혈압이시라면 국물은 살짝 남기시는 게 좋겠어요. 그래도 단백질 보충엔 딱이에요! 😊",
  "summary": "🔬 [Pigout AI 종합 분석] 이 음식은 단백질과 비타민이 풍부하여 영양학적으로 우수합니다. 다만, 현재 복용 중인 고혈압약(OO)과 관련하여 나트륨 섭취에 주의가 필요합니다. 약물 복용 2시간 전후로 섭취하시고, 국물은 절반만 드시는 것을 권장합니다."
}`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const parsed = this.extractJsonObject(rawText);

      // warnings가 없으면 빈 배열로 설정
      if (!parsed.warnings) {
        parsed.warnings = [];
      }
      // expertAdvice가 없으면 기본값 설정
      if (!parsed.expertAdvice) {
        parsed.expertAdvice =
          "균형 잡힌 식단의 일부로 적당량 섭취하시면 건강에 도움이 됩니다.";
      }

      return parsed;
    } catch (error) {
      console.error("AI 최종 분석 실패:", error);
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
      const diseaseList = diseases.length > 0 ? diseases.join(", ") : "없음";
      const drugList =
        finalAnalysis?.medicalAnalysis?.drug_food_interactions
          ?.map((i: any) => i.medicine_name)
          .join(", ") || "없음";

      const prompt = `# Role Definition
당신은 **Pigout AI**입니다. 영양학, 임상 약학 전문지식과 공공데이터 분석 결과를 바탕으로 사용자를 돕습니다.
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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const result = this.extractJsonObject(rawText);
      return result.recipes || [];
    } catch (error) {
      console.error("AI 레시피 추천 실패:", error);
      return [
        "신선한 재료를 사용하세요",
        "조리 시 염분과 당분을 적게 사용하세요",
        "채소를 많이 추가하면 더 건강해요",
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
    },
    userProfile?: { age?: number; gender?: string }
  ): Promise<{
    finalAnalysis: {
      pros: string[];
      cons: string[];
      nutrition: {
        calories: number;
        summary: string;
        highlight: string;
      };
      recipe: {
        substitutes: string;
        cookingMethod: string;
        intakeGuide: string;
        searchKeyword: string;
        videoId?: string;
        videoThumbnail?: string;
      };
      alternatives: Array<{
        name: string;
        reason: string;
        imageUrl?: string | null;
      }>;
      summary: string;
    };
  }> {
    try {
      const diseaseList = diseases.length > 0 ? diseases.join(", ") : "없음";
      const profileInfo = userProfile
        ? `${userProfile.age}세 ${
            userProfile.gender === "male"
              ? "남성"
              : userProfile.gender === "female"
              ? "여성"
              : ""
          }`
        : "정보 없음";
      const drugList =
        interactionAnalysis?.interactions
          ?.map((i: any) => i.medicine_name)
          .join(", ") || "없음";

      const prompt = `# Pigout AI - 음식 정밀 분석
사용자 맞춤형 정밀 분석을 수행하고, 결과를 **극도로 간결하고 직관적인 데이터**로 제공하세요.

**입력 데이터:**
- 음식: ${foodName}
- 사용자: ${profileInfo} | 질병: ${diseaseList} | 약물: ${drugList}
- 음식 성분: ${
        foodAnalysis.components?.map((c) => c.name).join(", ") || "분석 중"
      }
- 약물 상호작용: ${interactionAnalysis.interactions?.length || 0}건 (위험 ${
        interactionAnalysis.interactions?.filter(
          (i: any) => i.risk_level === "danger"
        ).length || 0
      }건)

답변은 반드시 아래 JSON 형식을 엄수하세요. (서술형 금지, 단어/구 단위 작성)

1. **pros (장점)**: 사용자의 건강/질병에 도움이 되는 핵심 장점 4~5개를 '단어' 또는 '짧은 구' 형태의 태그로 작성.
   - 예: ["근육 형성", "고단백", "활력 증진", "빈혈 예방"]

2. **cons (단점/주의)**: 주의해야 할 점 4~5개를 '단어' 또는 '짧은 구' 형태의 태그로 작성.
   - 예: ["나트륨 주의", "높은 칼로리", "산성 성분"]

3. **nutrition (영양 정보)**:
   - calories: 1인분 대략적 칼로리 (숫자만, 예: 350)
   - summary: 영양 구성 한 줄 요약 (예: "탄수화물 위주의 고열량 식단입니다.")
   - highlight: 가장 돋보이는 영양 성분 1가지 (예: "비타민 D 풍부")

4. **recipe (스마트 레시피)**: 이 음식을 가장 건강하게 먹는 방법
   - substitutes: 건강을 위한 재료 대체 팁 (1줄) (예: "설탕 대신 알룰로스 사용 권장")
   - cookingMethod: 건강한 조리법 핵심 (1줄) (예: "기름에 튀기지 않고 에어프라이어 조리")
   - intakeGuide: 섭취 방법 가이드 (1줄) (예: "국물은 남기고 건더기 위주로 섭취")
   - searchKeyword: YouTube에서 레시피 검색을 위한 최적 키워드 (예: "저염식 ${foodName} 레시피")

5. **alternatives (대체 음식 추천)**: 이 음식이 부담스러울 경우 선택할 수 있는 더 건강한 대체 음식 3가지.
   - name: 대체 음식 이름
   - reason: 추천 이유 (간결하게 10자 내외) (예: "나트륨이 50% 적음")

6. **summary**: 전체 종합 분석 (기존 서술형 유지, 3문장 내외로 전문적인 조언)

JSON 출력:
{
  "finalAnalysis": {
    "pros": ["태그1", "태그2"],
    "cons": ["태그1", "태그2"],
    "nutrition": { "calories": 0, "summary": "...", "highlight": "..." },
    "recipe": { "substitutes": "...", "cookingMethod": "...", "intakeGuide": "...", "searchKeyword": "..." },
    "alternatives": [{ "name": "...", "reason": "..." }],
    "summary": "..."
  }
}`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const parsed = this.extractJsonObject(rawText);

      // 기본값 설정 및 검증
      const finalAnalysis = parsed.finalAnalysis || {};

      if (!finalAnalysis.pros) finalAnalysis.pros = [`영양가 있는 ${foodName}`];
      if (!finalAnalysis.cons) finalAnalysis.cons = ["과식 주의"];
      if (!finalAnalysis.nutrition) {
        finalAnalysis.nutrition = {
          calories: 0,
          summary: "영양 정보 분석 불가",
          highlight: "",
        };
      }
      if (!finalAnalysis.recipe) {
        finalAnalysis.recipe = {
          substitutes: "신선한 재료 사용",
          cookingMethod: "건강한 조리법 권장",
          intakeGuide: "적당량 섭취",
          searchKeyword: `${foodName} 건강 레시피`,
        };
      }
      if (!finalAnalysis.alternatives) finalAnalysis.alternatives = [];
      if (!finalAnalysis.summary)
        finalAnalysis.summary = `${foodName}에 대한 분석 결과입니다.`;

      return { finalAnalysis };
    } catch (error) {
      console.error("AI 통합 분석 실패:", error);
      // 폴백
      return {
        finalAnalysis: {
          pros: [`영양가 있는 ${foodName}`],
          cons: ["과식 주의"],
          nutrition: {
            calories: 0,
            summary: "분석 실패",
            highlight: "",
          },
          recipe: {
            substitutes: "신선한 재료 사용",
            cookingMethod: "기름 적게 사용",
            intakeGuide: "적당량 섭취",
            searchKeyword: `${foodName} 레시피`,
          },
          alternatives: [],
          summary: `${foodName} 분석 중 오류가 발생했습니다.`,
        },
      };
    }
  }

  /**
   * 복용 중인 모든 약물 간 상호작용 종합 분석
   */
  async analyzeAllDrugInteractions(
    drugDetails: any[],
    userProfile?: { age?: number; gender?: string }
  ): Promise<{
    overallSafety: "safe" | "caution" | "danger";
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
      const drugNames = drugDetails.map((d) => d.name).join(", ");

      // 환자 정보 추가
      let patientInfo = "";
      if (userProfile && userProfile.age && userProfile.gender) {
        const genderKo = userProfile.gender === "male" ? "남성" : "여성";
        patientInfo = `\n\n**환자 정보:**\n- 나이: ${userProfile.age}세\n- 성별: ${genderKo}\n`;
      }

      const prompt = `# Role Definition
당신은 **Pigout AI**입니다. 임상 약학 전문지식과 공공데이터를 활용하여 약물 간 상호작용을 분석합니다.
사용자가 복용 중인 모든 약물의 상호작용을 종합적으로 분석하여, **동시 복용의 안전성**을 평가하는 것이 목표입니다.

---

# Input Data
**복용 중인 약물 목록:** ${drugNames}${patientInfo}

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
      let lastError: any;

      // 🔄 재시도 로직: 503/429 에러 시 최대 3회 재시도 (지수 백오프)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[analyzeAllDrugInteractions] 시도 ${attempt}/3`);
          rawText = await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
          ]);
          break; // 성공 시 루프 종료
        } catch (apiError: any) {
          lastError = apiError;
          const status = apiError.response?.status || apiError.status;
          console.error(
            `[analyzeAllDrugInteractions] 시도 ${attempt} 실패:`,
            status,
            apiError.message
          );

          // 503 (Service Unavailable) 또는 429 (Rate Limit) 에러 시 재시도
          if ((status === 503 || status === 429) && attempt < 3) {
            const waitTime = Math.pow(2, attempt) * 1000; // 2초, 4초, 8초
            console.warn(
              `[analyzeAllDrugInteractions] ${waitTime}ms 대기 후 재시도...`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          // 마지막 시도 실패 또는 재시도 불가능한 에러 - 안전 기본 응답 반환
          console.warn(
            "[analyzeAllDrugInteractions] 모든 시도 실패 - 안전 기본 응답 반환"
          );
          return {
            overallSafety: "caution" as const,
            overallScore: 70,
            dangerousCombinations: [],
            cautionCombinations:
              drugDetails.length > 1
                ? [
                    {
                      drug1: drugDetails[0]?.name || "약물1",
                      drug2: drugDetails[1]?.name || "약물2",
                      interaction: `현재 AI 분석 서비스가 일시적으로 사용 불가능합니다 (${
                        status === 503
                          ? "서버 과부하"
                          : status === 429
                          ? "API 한도 초과"
                          : "서비스 오류"
                      }). 안전을 위해 의사 또는 약사와 상담하세요.`,
                      recommendation:
                        "복용 전 반드시 의료 전문가와 상담하세요.",
                    },
                  ]
                : [],
            synergisticEffects: [],
            summary: `${drugDetails.length}개 약물의 상호작용 분석이 일시적으로 불가능합니다. 안전한 복용을 위해 의사 또는 약사와 상담하시기 바랍니다.`,
            recommendations: [
              "각 약물의 복용 시간을 최소 2시간 이상 간격으로 조절하세요.",
              "복용 전 반드시 의사 또는 약사와 상담하세요.",
              "이상 증상 발생 시 즉시 복용을 중단하고 전문가와 상담하세요.",
            ],
          };
        }
      }

      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error("AI 약물 상호작용 분석 실패:", error);
      throw new Error(`AI drug interaction analysis failed: ${error.message}`);
    }
  }

  /**
   * AI가 의약품/건강기능식품 정보 생성 (API 한도 초과 또는 검색 실패 시 대체)
   * @param productName 제품명
   * @param numOfRows 생성할 결과 수
   */
  async generateMedicineInfo(
    productName: string,
    numOfRows: number = 5
  ): Promise<any[]> {
    try {
      console.log(`[AI] 의약품/건강기능식품 정보 생성: ${productName}`);

      const prompt = `당신은 의약품 및 건강기능식품 전문가입니다.
사용자가 "${productName}"을(를) 검색했습니다.

이 제품과 관련된 의약품 또는 건강기능식품 정보를 ${Math.min(
        numOfRows,
        5
      )}개 생성해주세요.
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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const parsed = this.extractJsonArray(rawText);

      if (parsed && parsed.length > 0) {
        // e약은요 형식으로 변환하여 반환
        return parsed.map((item: any, idx: number) => ({
          itemName: item.itemName || productName,
          entpName: item.entpName || "AI 생성",
          itemSeq: item.itemSeq || `AI_${Date.now()}_${idx}`,
          efcyQesitm: item.efcyQesitm || "",
          useMethodQesitm: item.useMethodQesitm || "",
          atpnWarnQesitm: item.atpnWarnQesitm || "",
          atpnQesitm: item.atpnQesitm || "",
          intrcQesitm: item.intrcQesitm || "",
          seQesitm: item.seQesitm || "",
          depositMethodQesitm: item.depositMethodQesitm || "",
          itemImage: "",
          _isAIGenerated: true,
          _source: "AI 생성 (Gemini)",
          _productType: item.productType || "정보 없음",
        }));
      }

      return [];
    } catch (error) {
      console.error("[AI] 의약품 정보 생성 실패:", error.message);
      return [];
    }
  }

  /**
   * AI가 건강기능식품 정보 생성 (API 검색 실패 시 대체)
   * 실제 존재하는 건강기능식품을 기반으로 정보 생성
   * @param keyword 검색 키워드 (예: 오메가3, 비타민D, 유산균)
   * @param numOfRows 생성할 결과 수
   */
  async generateHealthFoodInfo(
    keyword: string,
    numOfRows: number = 10
  ): Promise<any[]> {
    try {
      console.log(`[AI] 건강기능식품 정보 생성: ${keyword}`);

      const prompt = `당신은 건강기능식품 전문가입니다.
사용자가 "${keyword}"을(를) 검색했습니다.

**중요: 실제로 한국에서 판매되고 있는 건강기능식품 제품을 기반으로 정보를 제공해주세요.**

"${keyword}"과 관련된 실제 건강기능식품 정보를 ${Math.min(
        numOfRows,
        10
      )}개 생성해주세요.

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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const parsed = this.extractJsonArray(rawText);

      if (parsed && parsed.length > 0) {
        // e약은요 형식으로 변환하여 반환
        return parsed.map((item: any, idx: number) => ({
          itemName: item.itemName || keyword,
          entpName: item.entpName || "AI 생성",
          itemSeq: item.itemSeq || `AI_HF_${Date.now()}_${idx}`,
          efcyQesitm: item.efcyQesitm || "",
          useMethodQesitm: item.useMethodQesitm || "",
          atpnWarnQesitm: item.atpnWarnQesitm || "",
          atpnQesitm: item.atpnQesitm || "",
          intrcQesitm: item.intrcQesitm || "",
          seQesitm: item.seQesitm || "",
          depositMethodQesitm: item.depositMethodQesitm || "",
          itemImage: "",
          _isAIGenerated: true,
          _isHealthFunctionalFood: true,
          _source: "AI 생성 (Gemini)",
          _rawMaterial: item.rawMaterial || "",
        }));
      }

      return [];
    } catch (error) {
      console.error("[AI] 건강기능식품 정보 생성 실패:", error.message);
      return [];
    }
  }

  /**
   * AI가 제품 유형을 분류 (의약품 vs 건강기능식품)
   * @param keyword 검색 키워드
   * @returns 'medicine' | 'healthFood' | 'unknown'
   */
  async classifyProductType(
    keyword: string
  ): Promise<"medicine" | "healthFood" | "unknown"> {
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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
        rawText = rawText.trim().toLowerCase();
      }

      console.log(`[AI] 제품 유형 분류 응답: ${rawText}`);

      if (
        rawText.includes("healthfood") ||
        rawText.includes("health_food") ||
        rawText.includes("건강기능식품")
      ) {
        return "healthFood";
      }
      if (rawText.includes("medicine") || rawText.includes("의약품")) {
        return "medicine";
      }

      return "unknown";
    } catch (error) {
      console.error("[AI] 제품 유형 분류 실패:", error.message);
      return "unknown";
    }
  }

  /**
   * 텍스트 번역 (한글 -> 영어)
   * Unsplash 검색어 생성을 위해 사용 (Gemini Flash 모델 사용)
   */
  async translateText(text: string): Promise<string> {
    try {
      const prompt = `Translate the following Korean food name or keyword into English for image search.
      Korean: "${text}"
      
      Output ONLY the English translation. No other text.`;

      let rawText: string;
      try {
        const result = await this.textModel.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } catch (sdkError) {
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      return rawText.trim();
    } catch (error) {
      console.warn(`[Gemini] 번역 실패: ${error.message}`);
      return text; // 실패 시 원본 반환
    }
  }

  /**
   * JSON 배열 추출 헬퍼
   */
  private extractJsonArray(raw: string): any[] {
    try {
      let cleaned = raw.trim();
      cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "");

      // 배열 시작/끝 찾기
      const startIdx = cleaned.indexOf("[");
      const endIdx = cleaned.lastIndexOf("]");

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
- 제조사: ${entpName || "알 수 없음"}
- 효능/효과: ${efcyQesitm || "정보 없음"}

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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const parsed = this.extractJsonObject(rawText);

      return {
        mainIngredient: parsed.mainIngredient || itemName,
        drugClass: parsed.drugClass || "일반의약품",
        components: parsed.components || [
          {
            name: itemName,
            category: "알 수 없음",
            description: "성분 정보 없음",
          },
        ],
      };
    } catch (error) {
      console.error("[AI] 약물 성분 추출 실패:", error.message);
      return {
        mainIngredient: itemName,
        drugClass: "알 수 없음",
        components: [
          {
            name: itemName,
            category: "알 수 없음",
            description: "성분 추출 실패",
          },
        ],
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
    dataCompleteness: "complete" | "partial" | "ai_enhanced";
  }> {
    try {
      const publicDataStr = publicData
        ? JSON.stringify(publicData, null, 2)
        : "공공데이터 없음";

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
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      return this.extractJsonObject(rawText);
    } catch (error) {
      console.error("[AI] 약품 정보 분석 실패:", error.message);
      return {
        name: medicineName,
        efficacy: "정보 없음",
        usage: "정보 없음",
        sideEffects: "정보 없음",
        precautions: "정보 없음",
        interactions: "정보 없음",
        storageMethod: "정보 없음",
        components: [],
        dataCompleteness: "partial",
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
  ): Promise<
    Array<{
      name: string;
      efficacy: string;
      usage: string;
      sideEffects: string;
      precautions: string;
      interactions: string;
      storageMethod: string;
      components: Array<{ name: string; description: string }>;
      dataCompleteness: "complete" | "partial" | "ai_enhanced";
    }>
  > {
    console.log(`[AI] ${medicines.length}개 약품 일괄 분석 시작...`);

    const results = await Promise.all(
      medicines.map((med) =>
        this.analyzeMedicineInfo(med.name, med.publicData).catch((err) => {
          console.warn(`[AI] ${med.name} 분석 실패:`, err.message);
          return {
            name: med.name,
            efficacy: "정보 없음",
            usage: "정보 없음",
            sideEffects: "정보 없음",
            precautions: "정보 없음",
            interactions: "정보 없음",
            storageMethod: "정보 없음",
            components: [],
            dataCompleteness: "partial" as const,
          };
        })
      )
    );

    console.log(`[AI] ${medicines.length}개 약품 분석 완료`);
    return results;
  }

  /**
   * 약품의 복용 시간대를 AI로 분석
   * @param medicineName 약품명
   * @param publicData 공공데이터 (용법용량 정보 포함)
   * @returns 복용 시간대 정보
   */
  async analyzeMedicineSchedule(
    medicineName: string,
    publicData?: any
  ): Promise<{
    timesPerDay: number;
    timeSlots: Array<"morning" | "afternoon" | "evening">;
    dosagePerTime: string;
    recommendation: string;
  }> {
    try {
      const publicDataStr = publicData
        ? JSON.stringify(publicData, null, 2)
        : "공공데이터 없음";

      const prompt = `당신은 약품 복용 시간 분석 전문가입니다.

약품명: ${medicineName}

공공데이터 (e약은요 API):
${publicDataStr}

---

# 복용 시간 분석 지침

1. **공공데이터 우선**: useMethodQesitm 필드에서 복용 시간 정보 추출
2. **약품명 기반 추론**: 약품명에서 약물 분류 파악 후 일반적 복용법 적용
3. **표준 가이드라인**: 약물 분류별 표준 복용 시간 적용

## 주요 분석 항목

1. **timesPerDay** (1일 복용 횟수)
   - 공공데이터: "1일 3회" → 3
   - 약품 분류 기반: 
     * 간 영양제(밀크씨슬 등): 1-2회
     * 소염진통제: 2-3회
     * 항생제: 3-4회
     * 만성질환약(고혈압/당뇨 등): 1-2회

2. **timeSlots** (복용 시간대, 배열)
   - morning: 아침 (06:00-12:00)
   - afternoon: 점심 (12:00-18:00)
   - evening: 저녁 (18:00-24:00)
   
   예시:
   - 1일 1회 → ["morning"]
   - 1일 2회 → ["morning", "evening"]
   - 1일 3회 → ["morning", "afternoon", "evening"]

3. **dosagePerTime** (1회 복용량)
   - "1정", "2정", "1캡슐" 등
   - 공공데이터에서 추출 또는 "1정" 기본값

4. **recommendation** (복용 권장사항, 50자 이상)
   - 식전/식후 여부
   - 특별 주의사항
   - 최적 복용 시간대

---

# 예시 분석

## 예시 1: 밀크씨슬 (간 영양제)
- timesPerDay: 1
- timeSlots: ["morning"]
- dosagePerTime: "1정"
- recommendation: "아침 식후 복용을 권장합니다. 간 건강 보조를 위해 꾸준한 복용이 중요합니다."

## 예시 2: 타이레놀 (해열진통제)
- timesPerDay: 3
- timeSlots: ["morning", "afternoon", "evening"]
- dosagePerTime: "1-2정"
- recommendation: "증상이 있을 때 4-6시간 간격으로 복용하세요. 1일 최대 8정을 초과하지 마세요."

## 예시 3: 콜킨정 (통풍 치료제)
- timesPerDay: 1
- timeSlots: ["morning"]
- dosagePerTime: "1정"
- recommendation: "아침 식후 복용을 권장합니다. 통풍 발작 예방을 위해 규칙적으로 복용하세요."

---

JSON 형식으로만 응답:

{
  "timesPerDay": 1 또는 2 또는 3,
  "timeSlots": ["morning"] 또는 ["morning", "evening"] 또는 ["morning", "afternoon", "evening"],
  "dosagePerTime": "1회 복용량 (예: 1정, 2정, 1캡슐 등)",
  "recommendation": "복용 권장사항 (50자 이상, 식전/식후, 주의사항 포함)"
}`;

      let rawText: string;
      try {
        rawText = await this.callWithRetry(async () => {
          return await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
          ]);
        });
      } catch (error) {
        console.warn(
          "[AI] 복용 시간 분석 실패, REST API 재시도:",
          error.message
        );
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const result = this.extractJsonObject(rawText);

      // 기본값 보장
      return {
        timesPerDay: result.timesPerDay || 1,
        timeSlots: result.timeSlots || ["morning"],
        dosagePerTime: result.dosagePerTime || "1정",
        recommendation:
          result.recommendation || "의사 또는 약사의 지시에 따라 복용하세요.",
      };
    } catch (error) {
      console.error("[AI] 복용 시간 분석 실패:", error.message);
      // 기본값 반환 (1일 1회, 아침)
      return {
        timesPerDay: 1,
        timeSlots: ["morning"],
        dosagePerTime: "1정",
        recommendation: "정확한 복용 시간은 의사 또는 약사와 상담하세요.",
      };
    }
  }

  /**
   * 약 등록 시 토큰 절약을 위한 추가 정보 생성
   * - 약물-음식 상호작용 요약
   * - 약물 카테고리/태그
   * - 주요 금기사항
   * @param medicineData 약 정보 (qr_code_data 또는 공공데이터)
   * @returns 토큰 최적화된 추가 정보
   */
  async generateMedicineEnhancedInfo(medicineData: {
    itemName: string;
    efcyQesitm?: string;
    useMethodQesitm?: string;
    atpnWarnQesitm?: string;
    atpnQesitm?: string;
    intrcQesitm?: string;
    seQesitm?: string;
    depositMethodQesitm?: string;
    aiAnalyzedInfo?: any;
  }): Promise<{
    foodInteractions: {
      avoid: string[];
      caution: string[];
      reason: string;
    };
    category: string;
    tags: string[];
    riskLevel: "low" | "medium" | "high";
    keyPrecautions: string[];
    summarizedInfo: {
      efficacy: string;
      usage: string;
      sideEffects: string;
      precautions: string;
      interactions: string;
    };
  }> {
    try {
      console.log(`[AI 약 정보 강화] 시작: ${medicineData.itemName}`);

      // AI 분석 정보가 있으면 우선 사용
      const efficacy =
        medicineData.aiAnalyzedInfo?.efficacy || medicineData.efcyQesitm || "";
      const usage =
        medicineData.aiAnalyzedInfo?.usage ||
        medicineData.useMethodQesitm ||
        "";
      const sideEffects =
        medicineData.aiAnalyzedInfo?.sideEffects || medicineData.seQesitm || "";
      const precautions =
        medicineData.aiAnalyzedInfo?.precautions ||
        medicineData.atpnWarnQesitm ||
        medicineData.atpnQesitm ||
        "";
      const interactions =
        medicineData.aiAnalyzedInfo?.interactions ||
        medicineData.intrcQesitm ||
        "";

      const prompt = `당신은 약물 정보 분석 전문가입니다.
다음 약물 정보를 분석하여 토큰 절약을 위한 핵심 정보만 추출하세요.

약물명: ${medicineData.itemName}

효능효과:
${efficacy.substring(0, 500)}

용법용량:
${usage.substring(0, 300)}

부작용:
${sideEffects.substring(0, 300)}

주의사항:
${precautions.substring(0, 500)}

상호작용:
${interactions.substring(0, 500)}

다음 정보를 JSON 형식으로 생성하세요:

{
  "foodInteractions": {
    "avoid": ["피해야 할 음식/성분 목록 (최대 5개, 구체적으로)"],
    "caution": ["주의해야 할 음식/성분 목록 (최대 5개)"],
    "reason": "상호작용 이유 (100자 이내, 핵심만)"
  },
  "category": "약물 카테고리 (예: 해열진통제, 항생제, 고혈압약, 당뇨약, 소화제 등)",
  "tags": ["주요 특성 태그 3-5개"],
  "riskLevel": "low | medium | high (부작용 위험도)",
  "keyPrecautions": ["핵심 주의사항 3-5개 (각 50자 이내)"],
  "summarizedInfo": {
    "efficacy": "효능 요약 (100자 이내)",
    "usage": "용법 요약 (80자 이내)",
    "sideEffects": "부작용 요약 (100자 이내)",
    "precautions": "주의사항 요약 (150자 이내)",
    "interactions": "상호작용 요약 (150자 이내)"
  }
}

요구사항:
1. 음식 상호작용은 구체적으로 (예: "자몽", "우유", "알코올")
2. 카테고리는 한 단어로 명확히
3. 위험도는 부작용과 상호작용을 고려
4. 핵심만 추출하여 토큰 절약`;

      let rawText: string;
      try {
        rawText = await this.callWithRetry(async () => {
          return await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
          ]);
        });
      } catch (error) {
        console.warn("[AI 약 정보 강화] REST API 재시도:", error.message);
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const result = this.extractJsonObject(rawText);

      console.log(
        `[AI 약 정보 강화] 성공: ${medicineData.itemName} - 카테고리: ${result.category}`
      );

      return {
        foodInteractions: result.foodInteractions || {
          avoid: [],
          caution: [],
          reason: "",
        },
        category: result.category || "일반의약품",
        tags: result.tags || [],
        riskLevel: result.riskLevel || "low",
        keyPrecautions: result.keyPrecautions || [],
        summarizedInfo: result.summarizedInfo || {
          efficacy: efficacy.substring(0, 100),
          usage: usage.substring(0, 80),
          sideEffects: sideEffects.substring(0, 100),
          precautions: precautions.substring(0, 150),
          interactions: interactions.substring(0, 150),
        },
      };
    } catch (error) {
      console.error("[AI 약 정보 강화] 실패:", error.message);
      // 기본값 반환
      return {
        foodInteractions: { avoid: [], caution: [], reason: "정보 없음" },
        category: "일반의약품",
        tags: [],
        riskLevel: "low",
        keyPrecautions: [],
        summarizedInfo: {
          efficacy: medicineData.efcyQesitm?.substring(0, 100) || "",
          usage: medicineData.useMethodQesitm?.substring(0, 80) || "",
          sideEffects: medicineData.seQesitm?.substring(0, 100) || "",
          precautions: (
            medicineData.atpnWarnQesitm ||
            medicineData.atpnQesitm ||
            ""
          ).substring(0, 150),
          interactions: medicineData.intrcQesitm?.substring(0, 150) || "",
        },
      };
    }
  }

  /**
   * 질병별 강화 정보 생성 (미리 캐싱용)
   * - 질병명만으로 생성 가능한 정보
   * - 식이 제한, 영양소 관리, 카테고리, 심각도 등
   */
  async generateDiseaseEnhancedInfo(diseaseName: string): Promise<{
    category: string;
    severity: "low" | "medium" | "high";
    chronicType: string;
    tags: string[];
    recommendedFoods: string[];
    avoidFoods: string[];
    cautionFoods: string[];
    dietaryReason: string;
    keyNutrients: {
      increase: string[];
      decrease: string[];
      dailyLimits: Record<string, string>;
    };
    complicationRisks: string[];
    generalPrecautions: string[];
  }> {
    try {
      console.log(`[AI 질병 정보 강화] 시작: ${diseaseName}`);

      const prompt = `당신은 질병 관리 및 영양학 전문가입니다.
다음 질병에 대한 식이 관리 정보를 생성하세요.

질병명: ${diseaseName}

다음 정보를 JSON 형식으로 생성하세요:

{
  "category": "질병 카테고리 (예: 대사성질환, 심혈관질환, 호흡기질환, 피부질환 등)",
  "severity": "low | medium | high (심각도)",
  "chronicType": "급성질환 | 만성질환 | 생활습관질환",
  "tags": ["관리 특성 태그 3-5개"],
  "recommendedFoods": ["적극 권장하는 음식 5-7개"],
  "avoidFoods": ["반드시 피해야 할 음식 3-5개"],
  "cautionFoods": ["주의가 필요한 음식 3-5개"],
  "dietaryReason": "식이 제한이 필요한 이유 (100자 이내)",
  "keyNutrients": {
    "increase": ["늘려야 할 영양소 3-5개"],
    "decrease": ["줄여야 할 영양소 3-5개"],
    "dailyLimits": {
      "sodium": "하루 권장량 (예: 2000mg)",
      "sugar": "하루 권장량 (예: 50g)"
    }
  },
  "complicationRisks": ["주요 합병증 위험 3-5개"],
  "generalPrecautions": ["일반적인 주의사항 3-5개 (각 50자 이내)"]
}

요구사항:
1. 음식은 한국인이 자주 먹는 음식 위주로
2. 구체적이고 실용적인 정보 제공
3. 의학적 근거에 기반
4. 일반인이 이해하기 쉽게`;

      let rawText: string;
      try {
        rawText = await this.callWithRetry(async () => {
          return await this.callWithRestApi("gemini-2.5-flash", [
            { text: prompt },
          ]);
        });
      } catch (error) {
        console.warn("[AI 질병 정보 강화] REST API 재시도:", error.message);
        rawText = await this.callWithRestApi("gemini-2.5-flash", [
          { text: prompt },
        ]);
      }

      const result = this.extractJsonObject(rawText);

      console.log(
        `[AI 질병 정보 강화] 성공: ${diseaseName} - 카테고리: ${result.category}`
      );

      return {
        category: result.category || "기타질환",
        severity: result.severity || "medium",
        chronicType: result.chronicType || "만성질환",
        tags: result.tags || [],
        recommendedFoods: result.recommendedFoods || [],
        avoidFoods: result.avoidFoods || [],
        cautionFoods: result.cautionFoods || [],
        dietaryReason: result.dietaryReason || "",
        keyNutrients: result.keyNutrients || {
          increase: [],
          decrease: [],
          dailyLimits: {},
        },
        complicationRisks: result.complicationRisks || [],
        generalPrecautions: result.generalPrecautions || [],
      };
    } catch (error) {
      console.error("[AI 질병 정보 강화] 실패:", error.message);
      return {
        category: "기타질환",
        severity: "medium",
        chronicType: "만성질환",
        tags: [],
        recommendedFoods: [],
        avoidFoods: [],
        cautionFoods: [],
        dietaryReason: "",
        keyNutrients: {
          increase: [],
          decrease: [],
          dailyLimits: {},
        },
        complicationRisks: [],
        generalPrecautions: [],
      };
    }
  }
}
