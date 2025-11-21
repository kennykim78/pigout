/**
 * Gemini Flash + Pro 프롬프트 템플릿
 * 토큰 최적화 및 역할 분리
 */

export class GeminiPrompts {
  /**
   * Flash: 빠른 종합 평가 및 점수 계산
   * 입력 토큰: ~800, 출력 토큰: ~400
   */
  static buildFlashPrompt(
    foodName: string,
    medicines: string[],
    diseases: string[],
  ): string {
    return `당신은 AI 헬스케어 분석가입니다. 빠르고 정확한 평가를 제공하세요.

[분석 대상]
음식: ${foodName}
복용약: ${medicines.length > 0 ? medicines.join(', ') : '없음'}
질병: ${diseases.join(', ')}

[요청]
1. 0-100 점수로 평가 (100=매우 안전, 0=매우 위험)
2. A-F 등급 (A=90+, B=80+, C=70+, D=60+, F=60 미만)
3. 주요 위험 요소 3가지 (간단히)
4. 추천 수준 (safe/caution/avoid/danger)

JSON 형식으로만 응답:
\`\`\`json
{
  "score": number,
  "grade": "A"|"B"|"C"|"D"|"F",
  "risks": ["위험1", "위험2", "위험3"],
  "recommendationLevel": "safe"|"caution"|"avoid"|"danger"
}
\`\`\``;
  }

  /**
   * Pro: 상세 건강 분석 및 글로벌 대체 식품 추천
   * 입력 토큰: ~1500, 출력 토큰: ~1800
   */
  static buildProPrompt(
    foodName: string,
    medicines: Array<{ name: string; purpose: string }>,
    diseases: string[],
    flashScore: number,
  ): string {
    const medicineInfo =
      medicines.length > 0
        ? medicines.map((m) => `${m.name} (${m.purpose})`).join(', ')
        : '없음';

    return `당신은 의약학 및 영양학 전문 AI 헬스케어 어드바이저입니다.

[환자 정보]
- 복용 중인 약물: ${medicineInfo}
- 기저질환: ${diseases.join(', ')}
- 섭취 예정 음식: ${foodName}
- 초기 평가 점수: ${flashScore}/100

[분석 요청]
다음 항목을 한국어로 작성하세요:

1. **약물-음식 상호작용 분석**
   각 약물별로 음식과의 상호작용 위험도를 평가하세요.

2. **질병별 영양학적 적합성**
   각 질병에 대해 이 음식이 미치는 영향을 설명하세요.

3. **상세 섭취 가이드**
   - 권장 섭취량
   - 최적 섭취 시간
   - 조리법 권장사항

4. **글로벌 대체 식품 추천**
   한국, 중국, 인도, 미국 전통 식품 중 더 안전한 대체 식품을 각 1개씩 추천하세요.

JSON 형식으로 응답:
\`\`\`json
{
  "detailedReason": "종합 분석 (300-500자)",
  "interactions": [
    {
      "medicine": "약물명",
      "riskLevel": "safe"|"caution"|"warning"|"danger",
      "description": "상호작용 설명 (100-200자)"
    }
  ],
  "nutritionGuidance": "영양 가이드 (200-400자)",
  "recommendations": ["추천사항1", "추천사항2", "추천사항3"],
  "globalRemedies": {
    "Korea": "한국 대체식품",
    "China": "중국 대체식품",
    "India": "인도 대체식품",
    "USA": "미국 대체식품"
  }
}
\`\`\``;
  }

  /**
   * Flash: 텍스트에서 음식 이름 추출 (기존)
   */
  static buildExtractFoodNamePrompt(userInput: string): string {
    return `다음 텍스트에서 음식 이름만 추출하세요. 음식 이름만 반환하고 다른 설명은 하지 마세요.

텍스트: "${userInput}"

음식 이름:`;
  }
}
