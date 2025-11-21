# 먹어도돼지? AI 모듈

Google Gemini 1.5를 활용한 음식 분석 AI 모듈입니다.

## 📋 구조

```
src/ai/
├── ai.module.ts              # AI 모듈 설정
├── ai.controller.ts          # REST API 엔드포인트
├── ai.service.ts             # 비즈니스 로직
├── dtos/
│   ├── analyze-image.dto.ts  # 이미지 분석 요청 DTO
│   └── analyze-text.dto.ts   # 텍스트 분석 요청 DTO
└── utils/
    ├── gemini.client.ts      # Gemini AI 클라이언트
    ├── rule-engine.ts        # 질병별 음식 평가 규칙
    └── score-calculator.ts   # 적합도 점수 계산기
```

## 🚀 설치

### 1. 패키지 설치
```bash
npm install @google/generative-ai axios class-validator class-transformer
```

### 2. 환경변수 설정 (.env)
```env
# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (이미 설정됨)
SUPABASE_URL=https://iziijnfbamnrypoxmpax.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Supabase 테이블 생성
`supabase-schema.sql` 파일의 SQL을 Supabase SQL Editor에서 실행하세요.

## 📡 API 엔드포인트

### 1. 이미지 분석
```http
POST /api/ai/analyze-image
Content-Type: application/json

{
  "userId": "user123",
  "diseases": ["hypertension", "diabetes"],
  "imagePath": "https://storage.supabase.co/..."
}
```

**응답:**
```json
{
  "foodName": "김치찌개",
  "confidence": 0.95,
  "score": 72,
  "pros": "발효식품으로 유산균이 풍부하며...",
  "cons": "나트륨 함량이 높아 고혈압 환자에게는...",
  "summary": "적당량 섭취 권장",
  "recordId": "uuid"
}
```

### 2. 텍스트 분석
```http
POST /api/ai/analyze-text
Content-Type: application/json

{
  "userId": "user123",
  "diseases": ["diabetes"],
  "textInput": "오늘 점심으로 비빔밥 먹었어요"
}
```

**응답:**
```json
{
  "foodName": "비빔밥",
  "confidence": 1.0,
  "score": 78,
  "pros": "다양한 채소로 비타민과 식이섬유가 풍부...",
  "cons": "탄수화물 함량이 높아 혈당 관리에 주의...",
  "summary": "채소 많이 섭취 권장",
  "recordId": "uuid"
}
```

### 3. 상세 분석
```http
GET /api/ai/detail/:recordId
```

**응답:**
```json
{
  "detailed_reason": "이 음식은 당뇨병 환자에게...",
  "risk_factors": [
    "높은 탄수화물 함량",
    "혈당 급상승 가능성",
    "나트륨 과다 섭취 위험"
  ],
  "nutrition_explanation": "100g당 탄수화물 45g, 나트륨 800mg...",
  "recommendation": "1회 섭취량을 절반으로 줄이고...",
  "global_remedies": [
    {
      "country": "Korea",
      "method": "발효식품과 함께 섭취하여 소화 촉진"
    },
    {
      "country": "China",
      "method": "식전 녹차로 혈당 조절"
    },
    {
      "country": "India",
      "method": "카레 향신료로 인슐린 민감도 개선"
    },
    {
      "country": "USA",
      "method": "저탄수화물 대체품 활용"
    }
  ]
}
```

## 🎯 질병 코드

- `hypertension`: 고혈압
- `diabetes`: 당뇨병
- `hyperlipidemia`: 고지혈증

## 🧮 점수 계산 로직

### 기본 점수
- 시작점: 100점

### 감점 요소
1. **질병 개수**
   - 1개: -5점
   - 2개: -10점
   - 3개: -15점

2. **음식 유형 위험도**
   - 질병별 위험 음식 키워드 감지
   - 예: 고혈압 + 찌개 = -15점

3. **영양소 위험도** (영양 데이터 있는 경우)
   - 임계값 초과 시 severity에 따라 감점
   - high: 최대 -30점
   - medium: 최대 -20점
   - low: 최대 -10점

### 최종 점수 범위
- 0~100점 (정수)
- 등급: A (80+), B (60+), C (40+), D (20+), F (0+)

## 🔧 개발 가이드

### 새로운 질병 규칙 추가

`src/ai/utils/rule-engine.ts`에 질병 규칙 추가:

```typescript
export const DISEASE_RULES: Record<string, DiseaseRule> = {
  // 기존 규칙...
  
  new_disease: {
    name: '새 질병',
    riskFactors: [
      { nutrient: 'nutrient_name', threshold: 100, severity: 'high' },
    ],
    foodTypeRisks: [
      { type: '위험음식', penalty: 20 },
    ],
  },
};
```

### Gemini 프롬프트 수정

`src/ai/utils/gemini.client.ts`의 각 메서드에서 프롬프트를 수정할 수 있습니다.

## 🧪 테스트

### 로컬 테스트
```bash
# 서버 시작
npm run start:dev

# 테스트 요청
curl -X POST http://localhost:3001/api/ai/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test",
    "diseases": ["diabetes"],
    "textInput": "김치찌개"
  }'
```

## 📝 TODO

- [ ] Supabase nutrition DB 연동
- [ ] 영양 정보 자동 조회 기능
- [ ] 캐싱 레이어 추가 (Redis)
- [ ] 배치 처리 기능 (여러 음식 동시 분석)
- [ ] 사용자 히스토리 분석
- [ ] A/B 테스팅 (다양한 프롬프트 전략)

## 🐛 문제 해결

### Gemini API 오류
- API 키 확인: `.env`의 `GEMINI_API_KEY` 설정 확인
- Quota 확인: Google Cloud Console에서 API 사용량 확인

### Supabase 연결 오류
- URL 및 키 확인
- RLS 정책 확인
- 네트워크 연결 확인

## 📚 참고 자료

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Supabase Documentation](https://supabase.com/docs)
