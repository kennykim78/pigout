# 의학적 분석 시스템 설정 가이드

## 개요

PigOut AI 시스템은 음식-약물 상호작용, 질병별 식이 가이드라인, 영양 분석을 통합하여 사용자에게 근거 기반 건강 정보를 제공합니다.

## 시스템 아키텍처

```
사용자 요청
  ↓
음식 분석 → 영양 DB (식품의약품안전처 API)
  ↓
약 분석 → 약학정보원 / 식약처 DUR API
  ↓
질병 분석 → 대한의학회 가이드라인 (내부 DB)
  ↓
RAG 데이터 수집 완료
  ↓
Gemini Pro → 의학적 분석 프롬프트 실행
  ↓
최종 JSON 결과 + 출처 목록
```

## 필요한 API 키

### 1. Google Gemini API
- **목적**: AI 기반 의학적 분석 수행
- **신청**: https://makersuite.google.com/app/apikey
- **환경변수**: `GEMINI_API_KEY`
- **무료 할당량**: 월 60 requests/분

### 2. 식품의약품안전처 의약품 개방 API
- **목적**: 의약품 정보, 약물 상호작용 조회
- **신청**: https://www.data.go.kr/
- **검색어**: "의약품 개방 API", "DUR 정보 조회"
- **환경변수**: `MFDS_API_KEY`
- **무료 사용 가능**

#### 주요 API 엔드포인트:
- **의약품 정보**: `/MdcinGrnIdntfcInfoService1/getMdcinGrnIdntfcInfoList1`
- **DUR 정보**: `/DURPrdlstInfoService03/getDurPrdlstInfoList03`

### 3. 식품영양성분 DB API
- **목적**: 음식 영양성분 정보 조회
- **신청**: https://www.data.go.kr/
- **검색어**: "식품영양성분 DB"
- **환경변수**: `NUTRITION_API_KEY`
- **무료 사용 가능**

## 설정 방법

### 1. 환경 변수 설정

`backend/.env` 파일 생성:

```bash
# AI Configuration
GEMINI_API_KEY=AIzaSy...your_actual_key

# Medical APIs
MFDS_API_KEY=your_mfds_api_key_from_data_go_kr
NUTRITION_API_KEY=your_nutrition_api_key_from_data_go_kr
```

### 2. API 키 신청 절차

#### Google Gemini API
1. https://makersuite.google.com/ 접속
2. Google 계정으로 로그인
3. "Get API Key" 클릭
4. 새 프로젝트 생성 또는 기존 프로젝트 선택
5. API 키 복사하여 `.env`에 저장

#### 공공데이터포털 (식약처/영양 API)
1. https://www.data.go.kr/ 접속
2. 회원가입 및 로그인
3. 검색창에 "의약품 개방 API" 검색
4. "활용신청" 클릭
5. 신청 후 승인 (보통 즉시 ~ 1일 소요)
6. "마이페이지 > 오픈API > 인증키 발급현황"에서 키 확인
7. 동일한 절차로 "식품영양성분 DB" API도 신청

### 3. Mock 데이터 모드

API 키가 없어도 시스템은 작동합니다:
- `MFDS_API_KEY`가 없으면 → Mock 의약품 데이터 사용
- `NUTRITION_API_KEY`가 없으면 → Mock 영양 정보 사용
- Gemini API만 있으면 기본 분석 가능

## 의학적 분석 프롬프트

시스템은 다음 원칙을 준수합니다:

### ✅ 반드시 수행
- 모든 분석은 제공된 RAG 데이터에서만 근거 추출
- 요약·판단 시 원문 출처를 함께 표시
- 모호한 정보는 "근거 불충분" 명시
- 의료적 위험도는 출처 기반 인용 형태로 표현

### ❌ 절대 금지
- 출처 없는 사실 임의 생성
- 중요한 의학적 뉘앙스 삭제
- 과학적 정보 없이 위험도 판단
- LLM 추론 기반 '가능성' 문구 삽입

## 분석 결과 JSON 구조

```typescript
{
  "food_name": "음식명",
  "medicine_name": "약물명",
  "disease_list": ["질병1", "질병2"],
  "interaction_assessment": {
    "level": "safe | caution | danger | insufficient_data",
    "evidence_summary": "출처 기반 요약",
    "detailed_analysis": "상세 분석 내용",
    "interaction_mechanism": "상호작용 메커니즘",
    "citation": ["출처1", "출처2"]
  },
  "nutritional_risk": {
    "risk_factors": ["위험 요소1", "위험 요소2"],
    "description": "출처 기반 설명",
    "citation": ["출처"]
  },
  "disease_specific_notes": [
    {
      "disease": "질병명",
      "impact": "영향 설명",
      "citation": ["출처"]
    }
  ],
  "final_score": 0-100
}
```

## 테스트

### API 연동 테스트

```bash
cd backend
npm run start:dev
```

PowerShell에서 테스트:

```powershell
# 음식 분석 (약물 정보 포함)
$body = @{
  foodName = "김치찌개"
  diseases = @("고혈압", "당뇨")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/food/text-analyze" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

### 로그 확인

백엔드 로그에서 확인:
- ✅ `MFDS API response: ...` → 식약처 API 성공
- ⚠️ `MFDS_API_KEY not configured, returning mock data` → Mock 모드
- ✅ `Nutrition API response: ...` → 영양 API 성공
- ✅ `Gemini medical analysis completed` → AI 분석 성공

## 데이터베이스 스키마

### medicine_records 테이블 (필요 시 생성)

```sql
CREATE TABLE IF NOT EXISTS medicine_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ingredients TEXT[] DEFAULT '{}',
  drug_class TEXT,
  dosage TEXT,
  frequency TEXT,
  start_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  qr_code_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE medicine_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own medicines"
  ON medicine_records FOR ALL
  USING (true)
  WITH CHECK (true);
```

## 문제 해결

### API 호출 실패

**증상**: `API error: timeout` 또는 `status 401`

**해결**:
1. API 키가 `.env`에 올바르게 설정되었는지 확인
2. 공공데이터포털에서 API 승인 상태 확인
3. API 트래픽 한도 확인 (일일 1000건 등)
4. Mock 모드로 임시 사용 (키 삭제 또는 주석 처리)

### Gemini API 할당량 초과

**증상**: `429 Resource Exhausted`

**해결**:
1. Google Cloud Console에서 할당량 확인
2. 유료 플랜으로 업그레이드
3. 요청 빈도 제한 (rate limiting) 구현

### 분석 결과 부정확

**증상**: 출처 없는 정보, 일관성 없는 답변

**해결**:
1. `medical-analysis-prompt.ts`의 시스템 프롬프트 확인
2. RAG 데이터가 제대로 수집되는지 로그 확인
3. Gemini Pro 모델 사용 확인 (`gemini-2.5-pro`)

## 추가 개선 방향

### 1. 실제 RAG 구현
현재는 외부 API 직접 호출이지만, 향후 벡터 DB(Pinecone, Weaviate) 활용 가능

### 2. 캐싱
동일한 음식/약물 조합은 캐싱하여 API 호출 최소화

### 3. 사용자 피드백
분석 결과의 정확도를 사용자가 평가하여 개선

### 4. 전문가 검증
의사, 약사의 검토를 거친 가이드라인 DB 구축

## 참고 문서

- [식약처 의약품 통합정보시스템](https://nedrug.mfds.go.kr/)
- [공공데이터포털](https://www.data.go.kr/)
- [대한의학회 진료지침](http://www.guideline.or.kr/)
- [Google Gemini API](https://ai.google.dev/)
