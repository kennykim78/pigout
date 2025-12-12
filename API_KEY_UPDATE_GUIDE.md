# API 키 교체 가이드

## 현재 상태
- **메인 키** (`AIzaSyDuDKe4NfqOhLoCL3n8l5_yLk6h2Bb_3lQ`): ❌ 무효화됨 (400 에러)
- **백업 키** (`AIzaSyAEa9ghSKS6eM4OWIrwtxYz-p_2V6o5X-Y`): ✅ 정상 작동

## Railway 환경변수 업데이트 필요

### 1. Railway 대시보드 접속
https://railway.app/dashboard

### 2. 프로젝트 선택
`pigout-backend` 프로젝트 선택

### 3. 환경변수 수정
**Variables** 탭에서:

```bash
# 기존 (무효한 메인 키)
GEMINI_API_KEY=AIzaSyDuDKe4NfqOhLoCL3n8l5_yLk6h2Bb_3lQ

# 변경 (정상 작동하는 백업 키로 교체)
GEMINI_API_KEY=AIzaSyAEa9ghSKS6eM4OWIrwtxYz-p_2V6o5X-Y

# 새로운 백업 키 추가 (Google AI Studio에서 생성)
GEMINI_API_KEY_BACKUP=<새로운_백업_키>
```

### 4. 자동 재배포
환경변수 변경 시 Railway가 자동으로 재배포합니다.

## 추가 개선사항 (이번 커밋에 포함)

### Rate Limiting 추가
- **문제**: 3개의 AI 호출이 연속으로 실행되어 분당 요청 제한(RPM) 초과
- **해결**: 각 API 호출 사이에 최소 1초 간격 보장
- **효과**: 429 에러(Too Many Requests) 발생 가능성 대폭 감소

### 구현 내용
```typescript
// 요청 간 최소 1초 간격 보장
private lastRequestTime: number = 0;
private minRequestInterval: number = 1000; // 1초

private async throttleRequest(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;
  
  if (timeSinceLastRequest < this.minRequestInterval) {
    const waitTime = this.minRequestInterval - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  this.lastRequestTime = Date.now();
}
```

## 호출 패턴 분석

### 기존 문제
```
analyzeFoodComponents       → Gemini API 호출 #1 (0초)
  ↓
analyzeDrugFoodInteractions → Gemini API 호출 #2 (~5초)
  ↓
generateFinalAnalysis       → Gemini API 호출 #3 (~10초)
```

**문제점**: 
- 3개 호출이 5-10초 내에 연속 실행
- Gemini API 무료 tier: **분당 15회 제한 (RPM)**
- 여러 사용자 동시 요청 시 RPM 초과 가능

### 개선 후
```
analyzeFoodComponents       → Gemini API 호출 #1 (0초)
  ↓ [1초 대기]
analyzeDrugFoodInteractions → Gemini API 호출 #2 (~6초)
  ↓ [1초 대기]
generateFinalAnalysis       → Gemini API 호출 #3 (~12초)
```

**개선점**:
- 강제 간격으로 RPM 분산
- 백업 키 자동 전환 시 재시도
- 429 에러 발생 시 안전한 fallback 응답

## 할당량 확인 스크립트

```bash
# 현재 API 할당량 체크
cd d:\Mybox\251112_pigout
$env:GEMINI_API_KEY="YOUR_MAIN_KEY"
$env:GEMINI_API_KEY_BACKUP="YOUR_BACKUP_KEY"
node check-quota.js
```

## Gemini API 무료 tier 제한

- **일일 요청**: 1,500회
- **분당 요청**: 15회 (RPM)
- **토큰 제한**: 
  - gemini-2.5-flash: 1,500,000 tokens/day
  - gemini-2.5-pro: 50 requests/day (더 엄격함)

## 참고
- Google AI Studio: https://aistudio.google.com/apikey
- Gemini API 문서: https://ai.google.dev/gemini-api/docs/quota
