# 캐싱 최적화 방안

## 📋 현재 상태 분석

### 활용 중인 캐싱 시스템
1. **food_rules (사전 등록 100개 음식)** - Result01만 활용
2. **medicine_analysis_cache (약물 상호작용)** - Medicine 페이지, 1살 단위로 세분화
3. **analysis_cache (음식 분석)** - 거의 미사용

### 문제점
- ❌ 나이가 1살 단위: 49세 ≠ 50세 → 캐시 적중률 극히 낮음
- ❌ 약물 조합까지 포함: A+B+C약 ≠ A+B약 → 거의 매칭 불가능
- ❌ food_rules가 Result2 스트리밍에서 미활용
- ❌ 토큰 낭비: 같은 음식을 연령대만 다르게 반복 분석

---

## 🎯 최적화 전략 (3단계 캐싱)

### 1단계: food_rules (사전 DB) - 최우선 ✅
**조건**: 음식명만 매칭 (나이/성별/약물 무관)
**활용**: Result01 + **Result2 초기 데이터**로 확장

```typescript
// food_rules 우선 조회 → 있으면 기본 정보로 활용
const foodRule = await getFoodRule(foodName);
if (foodRule) {
  // 기본 점수, 영양소, 장단점은 DB 활용
  // 나이/성별/약물 고려는 AI로 추가 분석만
}
```

### 2단계: 연령대 그룹 캐시 - 적중률 향상 🆕
**캐시 키**: `음식명 + 연령대(10세 단위) + 성별`
**약물 제외**: 약물은 캐시에서 제외하고 AI로 실시간 분석

```typescript
// 연령대 변환
function getAgeGroup(age: number): string {
  if (age < 20) return '10대';
  if (age < 30) return '20대';
  if (age < 40) return '30대';
  if (age < 50) return '40대';
  if (age < 60) return '50대';
  if (age < 70) return '60대';
  return '70대+';
}

// 캐시 키: "김치찌개_50대_남성"
const cacheKey = `${foodName}_${getAgeGroup(age)}_${gender}`;
```

**적중률 계산**:
- 기존 (1살 단위): 49세 남성의 캐시를 50세 남성이 못 씀 → **1%**
- 개선 (10세 단위): 40~49세 남성이 모두 공유 → **10배 향상**

### 3단계: 약물 상호작용은 별도 실시간 분석
**원칙**: 약물은 캐싱하지 않고 매번 AI 분석
**이유**: 
- 약물 조합이 너무 다양함 (A+B+C, A+D, B+C+E...)
- 약물별 상호작용은 결정론적이라 빠름 (~3초)

---

## 📦 구현 방안

### A안: 연령대 기반 음식 분석 캐시 (추천)

#### 1. 캐시 테이블 구조 변경
```sql
-- 기존 food_analysis 확장
ALTER TABLE food_analysis ADD COLUMN age_group TEXT; -- '20대', '30대', '40대'...
ALTER TABLE food_analysis ADD COLUMN gender TEXT; -- 'male', 'female'
ALTER TABLE food_analysis ADD COLUMN is_from_food_rules BOOLEAN DEFAULT false;

CREATE INDEX idx_food_analysis_cache 
ON food_analysis(food_name, age_group, gender);
```

#### 2. 캐시 조회 순서
```typescript
async analyzeFoodWithCache(foodName, age, gender, medicines) {
  // 1단계: food_rules DB 조회 (우선)
  const foodRule = await getFoodRule(foodName);
  if (foodRule) {
    console.log('[Cache] food_rules 적중');
    // 기본 정보는 DB에서, 약물 상호작용만 AI
    return await enhanceWithMedicineAnalysis(foodRule, medicines, age, gender);
  }

  // 2단계: 연령대 캐시 조회
  const ageGroup = getAgeGroup(age);
  const cached = await getCachedFoodAnalysis(foodName, ageGroup, gender);
  if (cached) {
    console.log('[Cache] 연령대 캐시 적중');
    return await enhanceWithMedicineAnalysis(cached, medicines, age, gender);
  }

  // 3단계: AI 전체 분석 (캐시 미스)
  console.log('[Cache] 미스 → AI 분석');
  const result = await fullAIAnalysis(foodName, age, gender, medicines);
  
  // 캐시 저장 (약물 정보 제외)
  await saveFoodAnalysisCache(result, foodName, ageGroup, gender);
  
  return result;
}
```

#### 3. 약물 상호작용 병합 함수
```typescript
async enhanceWithMedicineAnalysis(baseAnalysis, medicines, age, gender) {
  if (!medicines || medicines.length === 0) {
    return baseAnalysis;
  }

  // 약물 상호작용만 AI 실시간 분석 (~3초)
  const interactions = await analyzeDrugFoodInteractions(
    baseAnalysis.foodName,
    baseAnalysis.components,
    medicines,
    age,
    gender
  );

  // 기존 분석 + 약물 상호작용 병합
  return {
    ...baseAnalysis,
    drugInteractions: interactions,
    warnings: [...baseAnalysis.warnings, ...interactions.warnings],
    score: adjustScoreByInteractions(baseAnalysis.score, interactions),
  };
}
```

### B안: 간소화된 캐시 (최소 변경)

#### 1. medicine_analysis_cache만 연령대로 수정
```sql
-- 기존 테이블 수정
ALTER TABLE medicine_analysis_cache 
  DROP COLUMN age,
  ADD COLUMN age_group TEXT;

-- 기존 데이터 마이그레이션
UPDATE medicine_analysis_cache 
SET age_group = CASE 
  WHEN age < 20 THEN '10대'
  WHEN age < 30 THEN '20대'
  -- ...
END;
```

#### 2. 캐시 키 생성 함수 수정
```typescript
// backend/src/medicine/medicine.service.ts
function getCacheKey(medicineIds: string[], age: number, gender: string) {
  const ageGroup = getAgeGroup(age); // 10세 단위
  return `${medicineIds}_${ageGroup}_${gender}`;
}
```

---

## 📊 예상 효과

### 토큰 절감
| 시나리오 | 기존 (1살 단위) | 개선 (10세 단위 + food_rules) | 절감률 |
|---------|----------------|-------------------------------|--------|
| 김치찌개 + 50세 남성 | 매번 AI 분석<br>(~20,000 토큰) | food_rules 조회<br>(0 토큰) | **100%** |
| 김치찌개 + 약 3개 + 51세 남성 | 매번 AI 분석<br>(~25,000 토큰) | 연령대 캐시<br>(~5,000 토큰) | **80%** |
| 새 음식 + 49세 남성 | AI 분석<br>(~20,000 토큰) | AI 분석 후 캐시 저장<br>(~20,000 토큰) | 0% (최초)<br>**100%** (재방문) |

### 캐시 적중률
- **food_rules**: 100개 음식 = 상위 20% 커버 → **80% 적중**
- **연령대 캐시**: 10배 적중률 향상 (1% → 10%)
- **종합 적중률**: 50~60% (기존 1~5% 대비)

---

## 🚀 구현 우선순위

### Phase 1: 즉시 적용 (1시간)
1. ✅ **연령대 그룹화 함수 추가**
2. ✅ **medicine_analysis_cache 캐시 키 수정**
3. ✅ **Result2에서 food_rules 우선 조회**

### Phase 2: 최적화 (2시간)
4. ⏳ food_analysis 테이블 확장 (age_group, gender 컬럼)
5. ⏳ 연령대 기반 캐시 조회 로직
6. ⏳ 약물 상호작용 병합 함수

### Phase 3: 모니터링 (지속)
7. 📊 캐시 적중률 로그
8. 📊 토큰 사용량 비교
9. 📊 응답 속도 개선 측정

---

## 💡 추가 최적화 아이디어

### 1. 질병별 사전 계산
```sql
-- 질병 조합별 보정값 사전 계산
CREATE TABLE food_disease_modifiers (
  food_name TEXT,
  disease TEXT,
  score_modifier INTEGER,
  warnings TEXT[]
);
```

### 2. 인기 음식 프리페치
```typescript
// 접속 시 상위 10개 음식 캐시 미리 로드
const popularFoods = ['김치찌개', '된장찌개', '삼겹살', ...];
await Promise.all(popularFoods.map(food => prefetchCache(food)));
```

### 3. 점진적 캐시 워밍
```typescript
// 백그라운드에서 100개 음식 순차 분석
cron.schedule('0 2 * * *', async () => {
  for (const food of foodRules) {
    for (const ageGroup of ['20대', '30대', ...]) {
      for (const gender of ['male', 'female']) {
        await analyzeFoodWithCache(food, ageGroup, gender, []);
      }
    }
  }
});
```

---

## 🎓 결론

**권장 방안**: **A안 (연령대 기반 캐시)**
- food_rules 100개 = 상위 80% 커버
- 연령대 그룹화 = 10배 적중률
- 약물은 실시간 분석 = 정확도 유지

**기대 효과**:
- 🚀 응답 속도: 15초 → 2~5초
- 💰 토큰 비용: 80% 절감
- 🎯 캐시 적중률: 50~60%
