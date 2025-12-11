# 🔍 현재 분석 시스템 문제점 & 개선 방안 분석

## 📋 Executive Summary

현재 시스템은 **Result2 (음식 분석)** 와 **Medicine 페이지 (약품 분석)** 에서 성능 및 UX 문제를 겪고 있습니다. 이는 크게 다음 세 가지로 나뉩니다:

1. **성능 문제**: 분석 속도 (1분 이상 소요)
2. **UX 문제**: 텍스트 위주, 시각적 피로도 높음
3. **기능 문제**: 약품 상세 분석 미흡, 단계적 스트리밍 부족

---

## 🚨 현재 시스템 문제점 분석

### 1️⃣ Result2 분석 (음식+약물 상호작용)

#### **문제 1: 느린 분석 속도 (1분 이상)**

**근본 원인:**
```
순차 실행 구조 (Gemini API 3번 호출)
└─ 1단계: 약물 정보 조회 (getMedicineInfo) → ~2초
└─ 2단계: 성분 분석 (analyzeFoodComponents) → ~10초 (Gemini Pro)
└─ 3단계: 상호작용 분석 (analyzeDrugFoodInteractions) → ~15초 (Gemini Pro)
└─ 4단계: 최종 분석 (generateFinalAnalysisWithRecipes) → ~20초 (Gemini Pro)
└─ 총 소요 시간: ~50초 + 네트워크 지연 + Gemini 대기열

추가 병목:
- 레시피 데이터 조회 (비동기지만 최종 분석에 필요)
- 의약품 API 캐시 미스 (최대 3초/약물)
- Gemini Flash 미사용 (Pro만 사용 → 느림)
```

**현재 구조:**
```typescript
// food.service.ts:1200줄대
async analyzeFoodByTextStream() {
  // 1단계: 약물 정보 조회 (순차)
  const drugDetails = await Promise.all(...); // 약 3초
  
  // 2단계: 공공데이터 조회 (병렬)
  [nutritionRows, healthFoodRows] = await Promise.all(...); // ~2초
  
  // 3단계: AI 성분 분석 (순차) ← 병목!
  const foodAnalysis = await geminiClient.analyzeFoodComponents(...); // ~10초
  
  // 4단계: 상호작용 분석 (순차) ← 병목!
  const interactionAnalysis = await geminiClient.analyzeDrugFoodInteractions(...); // ~15초
  
  // 5단계: 최종 분석 (순차) ← 병목!
  const finalAnalysis = await geminiClient.generateFinalAnalysisWithRecipes(...); // ~20초
}
```

#### **문제 2: 텍스트 위주의 시각화**

**현상:**
- 좋은점/나쁜점/경고: 순수 텍스트 리스트
- 약물-음식 상호작용: 카드형 텍스트만 표시
- 성분 분석: 무작위 나열
- 차트 (AnalysisDashboard): 있지만 연관성 부족

**시각적 피로도:**
```
┌─────────────────────────────────────────┐
│ 좋은점                                   │
│ ✅ 뭐뭐가 좋아요 (텍스트)              │
│ ✅ 이것도 좋아요 (텍스트)              │
│ ✅ 저것도 좋아요 (텍스트)              │
├─────────────────────────────────────────┤
│ 나쁜점                                   │
│ ❌ 주의해야 할 것 (텍스트)             │
│ ❌ 피해야 할 것 (텍스트)               │
├─────────────────────────────────────────┤
│ 경고                                     │
│ 🚨 이것 때문에 위험 (텍스트)           │
│ ⚠️ 저것 때문에 주의 (텍스트)           │
├─────────────────────────────────────────┤
│ 약물 상호작용                            │
│ 약물명1 - 위험 (카드 텍스트)           │
│ 약물명2 - 주의 (카드 텍스트)           │
└─────────────────────────────────────────┘
  → 화면의 70% 이상이 텍스트
  → 스크롤 양 많음
  → 정보 우선순위 불명확
```

#### **문제 3: 현재 스트리밍 구조의 한계**

**현상:**
- 10초 후 시작하지만, 시작 후 ~50초 걸림
- 광고 시간 (10초) 동안에 분석 시작 X
- 중간 로딩 상태가 불명확함

**현재 흐름:**
```
사용자가 Result2로 진입
↓
useEffect 실행
↓
(경우 1) detailedAnalysis가 있으면 → 즉시 표시 (스트리밍 X)
(경우 2) 없으면 → 10초 후 startStreamingAnalysis 호출
↓
분석 시작 (이때 이미 광고 시간 지남)
↓
5단계 순차 실행 (~50초 소요)
↓
완료 후 모든 데이터 한번에 표시
```

---

### 2️⃣ Medicine 페이지 분석 (약품 상세 분석)

#### **문제 1: 단순한 상호작용 분석**

**현황:**
```typescript
// medicine.service.ts:880줄대
async analyzeAllMedicineInteractions(userId: string) {
  // 1단계: 약물 정보 조회
  const drugDetails = await Promise.all([
    getMedicineInfo, 
    getPillIdentificationInfo, 
    getDrugApprovalInfo
  ]);
  
  // 2단계: 바로 AI 분석 (데이터 검증 X)
  const analysisResult = await geminiClient.analyzeAllDrugInteractions(drugDetails);
  
  // 반환: 위험한 조합, 주의 필요, 시너지 효과만 분류
  return {
    dangerousCombinations: [...],
    cautionCombinations: [...],
    synergisticEffects: [...]
  };
}
```

**문제점:**
- **텍스트만 있음**: 약물 간 관계도/네트워크 표시 X
- **상세 분석 부족**: 각 상호작용의 원인/메커니즘 미기술
- **복용 시간 고려 X**: 시간대별 상호작용 분석 없음
- **용량 고려 X**: 복용량에 따른 위험도 차등화 X
- **개별 약물 프로필 없음**: 각 약물의 성분/기능 분석 없음

**현재 구조:**
```typescript
// 반환 데이터 (텍스트만)
{
  dangerousCombinations: [
    {
      medicine1: "아세트아미노펜",
      medicine2: "이부프로펜",
      reason: "둘 다 비스테로이드 약물이라...",  // 텍스트
      recommendation: "한 가지만 선택..."  // 텍스트
    }
  ]
}
```

#### **문제 2: 시각화 부족**

**Medicine 페이지 현황:**
```
MedicineRadarChart: 성분 기반 분석 (시각화 O)
├─ 효능
├─ 부작용
├─ 상호작용
└─ 복용 난이도

MedicineCorrelationSummary: 상호작용 요약 (텍스트 O)
└─ 위험도별 분류만

MedicineDetailPopup: 약물 상세정보 (텍스트 O)
├─ 효능
├─ 용법
├─ 주의사항
└─ 텍스트로만 표시
```

**문제:** 
- 약물 간 **네트워크 관계** 시각화 없음
- **타임라인** 기반 상호작용 분석 없음
- **성분 겹침** 부각 안됨

#### **문제 3: 스트리밍 분석 부재**

**현상:**
```typescript
// Medicine 페이지
const handleAnalyzeAll = async () => {
  setIsAnalyzing(true);
  
  // 한번의 API 호출 (스트리밍 X)
  const result = await analyzeAllMedicines();
  
  // 모든 분석 완료 후 한번에 표시
  setAnalysisResult(result);
  setIsAnalyzing(false);
};
```

**문제:**
- UI/UX 피드백 부족 (로딩 상태만 표시)
- 분석 과정 불투명
- 진행률 표시 X

---

## ✅ 개선 방안

### 🎯 목표
1. **성능**: 분석 시간 → 50초 → **15초 이내**
2. **UX**: 텍스트 위주 → **시각화 + 단계적 스트리밍**
3. **기능**: 상호작용 분석 → **상세한 약물 프로필 + 네트워크 분석**

---

## 📐 개선 전략

### 🚀 Part 1: Result2 (음식 분석) 최적화

#### **개선 1-1: 병렬 처리 + Flash 모델 사용**

**변경 전:**
```
약물 조회 (2초)
→ 성분 분석 (10초, Pro)
→ 상호작용 분석 (15초, Pro)
→ 최종 분석 (20초, Pro)
─────────────────
총 ~50초
```

**변경 후 (병렬 + Flash):**
```
약물 조회 (2초)
   ├─ 성분 분석 (3초, Flash) ──┐
   ├─ 공공데이터 조회 (1초)    ├─ 병렬 실행
   └─ 레시피 조회 (1초)       │
         ↓ (4초 경과)           │
   상호작용 분석 (5초, Flash) ──┤
         ↓ (9초 경과)           │
   최종 종합 (4초, Flash) ─────┤
─────────────────────────────
총 ~12초 (순차 70% 단축)
```

**구현 내용:**
```typescript
// 변경 전: 순차 실행
const foodAnalysis = await geminiClient.analyzeFoodComponents(...); // 10초
const interactionAnalysis = await geminiClient.analyzeDrugFoodInteractions(...); // 15초

// 변경 후: 병렬 실행 + Flash 사용
const [foodAnalysis, interactionAnalysis] = await Promise.all([
  geminiClient.analyzeFoodComponents_Flash(...), // 3초
  geminiClient.analyzeDrugFoodInteractions_Flash(...) // 5초 (병렬)
]); // 총 5초 (가장 긴 작업 기준)
```

---

#### **개선 1-2: 단계별 스트리밍 분석 (10초부터 시작)**

**개선 목표:**
- 광고 시간 동안 분석 시작 (10초 후가 아닌 지금 바로)
- 중간 단계 결과 즉시 표시

**새로운 흐름:**

```
[광고 시간 (10초)] 동안에도 분석 진행
├─ 0초: Result2 진입
├─ 0.1초: startStreamingAnalysis 호출 (지연 X)
│
├─ 1초: Stage 1 완료 → "약물정보 수집" 진행 바 표시
├─ 2초: Stage 2 완료 → "성분 정보" 프리뷰 표시
│
└─ 10초: 광고 끝남, 사용자가 화면 볼 때 이미 50% 진행
        └─ Stage 3 완료 → "상호작용 분석" 표시
        
├─ 15초: Stage 4 완료 → 최종 분석
├─ 20초: Stage 5 완료 → 전체 분석 완료
└─ 완료 화면 표시
```

**수정 사항:**
```typescript
// Result2.jsx: useEffect에서
useEffect(() => {
  if (location.state?.foodName) {
    // 변경: 10초 지연 제거
    // 변경 전:
    // setTimeout(() => startStreamingAnalysis(...), 10000);
    
    // 변경 후: 즉시 시작
    startStreamingAnalysis(location.state.foodName);
  }
}, [location.state]);
```

---

#### **개선 1-3: 5개 단계 → 7개 세부 단계로 분해**

**새로운 단계 구조:**

```
1️⃣ 약물정보 수집 (1초)
   └─ "복용 중인 약물을 확인하고 있어요"
   └─ 약물 아이콘 + 개수 프리뷰

2️⃣ 식품성분 기초분석 (2초)
   └─ "음식의 영양성분을 분석 중..."
   └─ 성분 태그 부분 표시

3️⃣ 성분 상세분석 (3초)
   └─ "건강상 위험요소를 검토 중..."
   └─ 위험도 컬러 바 표시

4️⃣ 약물 상호작용 빠른검사 (2초)
   └─ "약물과의 상호작용을 검토 중..."
   └─ 위험/주의 개수 표시

5️⃣ 약물 상호작용 상세분석 (3초)
   └─ "상세 상호작용을 분석 중..."
   └─ 약물 카드 부분 표시

6️⃣ 최종종합분석 (2초)
   └─ "최종 평가를 정리 중..."
   └─ 점수 + 권장사항 프리뷰

7️⃣ 시각화 생성 (1초)
   └─ "차트를 준비하고 있어요"
   └─ 차트 표시
```

**프로토콜:**
```typescript
// food.service.ts
async analyzeFoodByTextStream(...) {
  // Stage 1: 약물정보
  sendEvent('stage', { stage: 1, name: '약물정보', status: 'loading' });
  const medicines = await getMedicines();
  sendEvent('stage', { stage: 1, name: '약물정보', status: 'complete', data: { count, names } });
  
  // Stage 2: 성분 기초
  sendEvent('stage', { stage: 2, name: '성분기초', status: 'loading' });
  const basicAnalysis = await geminiClient.analyzeBasicFoodComponents(foodName);
  sendEvent('partial', { type: 'basic_components', data: basicAnalysis });
  sendEvent('stage', { stage: 2, name: '성분기초', status: 'complete' });
  
  // Stage 3: 성분 상세
  sendEvent('stage', { stage: 3, name: '성분상세', status: 'loading' });
  const detailedComponents = await geminiClient.analyzeDetailedComponents(...);
  sendEvent('partial', { type: 'detailed_components', data: detailedComponents });
  sendEvent('stage', { stage: 3, name: '성분상세', status: 'complete' });
  
  // Stage 4: 상호작용 빠른검사
  sendEvent('stage', { stage: 4, name: '상호작용검사', status: 'loading' });
  const quickInteraction = await geminiClient.quickInteractionCheck(...);
  sendEvent('stage', { stage: 4, name: '상호작용검사', status: 'complete' });
  
  // Stage 5: 상호작용 상세
  sendEvent('stage', { stage: 5, name: '상호작용상세', status: 'loading' });
  const detailedInteraction = await geminiClient.analyzeDetailedInteractions(...);
  sendEvent('partial', { type: 'interactions', data: detailedInteraction });
  sendEvent('stage', { stage: 5, name: '상호작용상세', status: 'complete' });
  
  // ... 나머지 stages
}
```

---

#### **개선 1-4: 시각화 개선**

**현재:**
- AnalysisDashboard: 제네릭 차트만 표시
- 약물-음식 관계: 텍스트 카드만

**개선:**

**A. 음식-약물 상호작용 맵**
```
┌─────────────────────────────────────┐
│        음식: 김치찌개               │
│  (고염도, 캡사이신, 발효 성분)      │
└────────────────┬────────────────────┘
                 │
        ┌────────┼────────┐
        ↓        ↓        ↓
      약1      약2      약3
  (아스피린) (감기약) (위장약)
  
  [위험]  [주의]  [안전]
  
  상호작용:
  - 아스피린 ⊕ 고염도 → 위장자극 증가 [위험]
  - 감기약 ⊕ 캡사이신 → 부작용 위험 [주의]
  - 위장약 ⊕ 발효 → 시너지 [좋음]
```

**B. 성분별 위험도 칼럼**
```
성분명          위험도    함량
─────────────────────────────
고염도          🔴위험    2500mg
캡사이신        🟡주의    150mg
발효성분        🟢안전    자연함유
비타민B        🟢안전    234mg
```

**C. 약물-약물 상호작용 네트워크 (Medicine 페이지)**
```
      아스피린
        / \
       /   \
    감기약  위장약
       \   /
        \ /
     의약 성분 겹침 (3개)
     
     관계 강도:
     ━━━ 위험 (직접 상호작용)
     ─ ─ 주의 (간접 영향)
     · · 안전 (상호보완)
```

---

### 🚀 Part 2: Medicine 페이지 (약품 분석) 최적화

#### **개선 2-1: 약물 상세 프로필 추가**

**목표:** 각 약물의 독립적인 정보 카드 추가

**구조:**
```
┌─────────────────────────────────────┐
│ 약물명: 타이레놀 500mg              │
│ 제조사: Johnson & Johnson           │
├─────────────────────────────────────┤
│ 📊 프로필                            │
│ ├─ 효능: 해열·진통                 │
│ ├─ 주요 성분: Acetaminophen        │
│ ├─ 복용: 하루 3-4회, 4시간 간격   │
│ └─ 부작용: 극히 드문 간독성         │
├─────────────────────────────────────┤
│ ⚡ 상호작용                         │
│ ├─ 감기약과: 중복 피하기 [위험]    │
│ ├─ 혈액응고제와: 상담 필요 [주의]  │
│ └─ 비타민과: 안전 [좋음]           │
├─────────────────────────────────────┤
│ ⏰ 복용 타이밍                       │
│ ├─ 아침 7시 (아스피린)              │
│ ├─ 점심 12시 (타이레놀) ← 4시간    │
│ └─ 저녁 7시 (감기약)                │
└─────────────────────────────────────┘
```

**데이터 모델:**
```typescript
// 확장된 drugDetail
{
  name: "타이레놀",
  publicData: { ... },
  profile: {
    mainComponent: "Acetaminophen",
    efficacy: ["해열", "진통"],
    dosage: "하루 3-4회, 4시간 간격",
    sideEffects: ["극히 드문 간독성"],
    maxDailyDose: 4000
  },
  interactions: [
    { medicine: "감기약", risk: "danger", reason: "Acetaminophen 중복" },
    { medicine: "혈액응고제", risk: "caution", reason: "간대사 영향" }
  ],
  scheduledTime: "12:00" // 사용자가 지정한 시간
}
```

---

#### **개선 2-2: 약물-약물 상호작용 네트워크 시각화**

**목표:** 네트워크 그래프로 약물 간 관계 시각화

**컴포넌트: MedicineInteractionNetwork.jsx**

```
기술:
- D3.js 또는 react-force-graph 사용
- 각 약물을 노드로, 상호작용을 엣지로 표현

시각화:
  ┌──────────────────────────────┐
  │     약물 상호작용 네트워크   │
  │                              │
  │      감기약 ──(위험)── 타이레놀
  │      /  \                 /  \
  │  (주의)  (안전)       (안전) (주의)
  │    /      \             /      \
  │ 위장약  혈액응고제  비타민    소염제
  │                              │
  │  [위험: 2] [주의: 4] [안전: 3] │
  └──────────────────────────────┘

인터랙션:
- 노드 클릭 → 약물 상세 프로필 표시
- 엣지 호버 → 상호작용 설명 표시
- 색상 코딩: 🔴위험 🟡주의 🟢안전
```

---

#### **개선 2-3: 약물 스트리밍 분석 추가**

**목표:** Medicine 페이지에서도 단계적 스트리밍

**새로운 분석 엔드포인트:**
```
POST /api/medicine/analyze-interactions-stream
```

**흐름:**
```
사용자: "내 약 종합 분석하기" 클릭
  ↓
SSE 연결 시작
  ↓
1️⃣ 약물정보 수집 (2초)
   └─ sendEvent('stage', { stage: 1, status: 'complete' })
   
2️⃣ 각 약물 상세조회 (3초, 병렬)
   └─ sendEvent('partial', { type: 'drug_profiles', data: [...] })
   
3️⃣ 상호작용 분석 (4초)
   └─ sendEvent('partial', { type: 'interactions', data: [...] })
   
4️⃣ 네트워크 생성 (1초)
   └─ sendEvent('partial', { type: 'network', data: graphData })
   
5️⃣ 최종 평가 (2초)
   └─ sendEvent('result', { success: true, data: {...} })

총 소요: ~12초
```

**구현:**
```typescript
// medicine.service.ts (신규 메서드)
async analyzeAllMedicineInteractionsStream(
  userId: string,
  sendEvent: (event: string, data: any) => void
) {
  // 1단계: 약물정보
  sendEvent('stage', { stage: 1, message: '약물 정보를 수집 중...' });
  const medicines = await getMedicines(userId);
  sendEvent('stage', { stage: 1, status: 'complete' });
  
  // 2단계: 상세조회 (병렬)
  sendEvent('stage', { stage: 2, message: '각 약물의 상세정보를 조회 중...' });
  const drugProfiles = await Promise.all(
    medicines.map(m => enrichDrugProfile(m))
  );
  sendEvent('partial', { type: 'drug_profiles', data: drugProfiles });
  sendEvent('stage', { stage: 2, status: 'complete' });
  
  // 3단계: 상호작용 분석
  sendEvent('stage', { stage: 3, message: '약물 간 상호작용을 분석 중...' });
  const interactions = await geminiClient.analyzeAllDrugInteractions(drugProfiles);
  sendEvent('partial', { type: 'interactions', data: interactions });
  sendEvent('stage', { stage: 3, status: 'complete' });
  
  // 4단계: 네트워크 생성
  sendEvent('stage', { stage: 4, message: '상호작용 네트워크를 생성 중...' });
  const networkData = buildInteractionNetwork(drugProfiles, interactions);
  sendEvent('partial', { type: 'network', data: networkData });
  sendEvent('stage', { stage: 4, status: 'complete' });
  
  // 5단계: 최종 평가
  sendEvent('stage', { stage: 5, message: '최종 평가를 정리 중...' });
  const finalReport = await geminiClient.generateMedicineReport(drugProfiles, interactions);
  sendEvent('result', { success: true, data: finalReport });
}
```

---

#### **개선 2-4: 복용 시간표 기반 상호작용 분석**

**목표:** 시간대별로 상호작용 위험도 변화 분석

**시각화: Timeline View**
```
시간    약물            성분          위험도
──────────────────────────────────────────
7:00   아스피린      Acetylsalicylic A   
12:00  타이레놀      Acetaminophen   🔴4시간 안에 아스피린과 위험!
14:00  감기약        Aspirin 함유    🔴타이레놀과 중복!
19:00  혈액응고제    Warfarin        🟡아스피린과 상호작용

분석:
- 12-14시: 최고 위험 [Acetaminophen ⊕ Aspirin ⊕ Aspirin(감기약)]
- 권장: 감기약을 19:00 이후로 변경
```

---

## 🎨 UI/UX 개선 (Result2 & Medicine)

### Result2 시각화 개선

**Before:**
```
┌─────────────────────┐
│ [헤더]              │
│ 음식명 / 이미지     │
├─────────────────────┤
│ [분석 진행 바]      │
│ [단계별 상태]       │
├─────────────────────┤
│ [좋은점 텍스트]     │ ← 긴 리스트
│ [나쁜점 텍스트]     │ ← 긴 리스트
│ [경고 텍스트]       │ ← 긴 리스트
│ [약물 카드들]       │ ← 긴 리스트
│ [차트]              │ ← 무관한 듯
└─────────────────────┘
```

**After:**
```
┌─────────────────────────────────┐
│ [헤더 + 이미지]                 │
├─────────────────────────────────┤
│ [분석 진행: 단계별 시각화]      │
│ [1]✓ [2]✓ [3]▶ [4] [5]         │
│ "약물 상호작용 분석 중..."      │
├─────────────────────────────────┤
│ 📊 [핵심 요약 카드]             │
│ ├─ 종합점수: 73/100            │
│ ├─ 위험약물: 1개               │
│ └─ 시너지: 2개                 │
├─────────────────────────────────┤
│ 🎯 [상호작용 맵] (시각화)      │
│ (음식 ↔ 약물 네트워크)          │
├─────────────────────────────────┤
│ ⚠️ [핵심 경고] (접이식)         │
│ ✅ [좋은점] (접이식)            │
│ ❌ [나쁜점] (접이식)            │
│ 💊 [약물상호작용] (접이식)      │
├─────────────────────────────────┤
│ 📈 [차트] (연관성 높은 정보)    │
│ - 영양소별 함유량               │
│ - 약물별 위험도                 │
└─────────────────────────────────┘
```

**핵심 개선:**
1. **Accordion 형식** (접이식) → 기본 정보만 보임
2. **핵심 정보 우선** → 요약 카드 상단 배치
3. **시각화 강화** → 텍스트 40% → 20%로 감소
4. **맵 기반 시각화** → 관계도 명확화

### Medicine 시각화 개선

**Before:**
```
┌──────────────┐
│ [약물 리스트]│
│ ✓ 약1      │
│ ✓ 약2      │
│ ✓ 약3      │
├──────────────┤
│ [분석 버튼]  │
├──────────────┤
│ [결과]       │
│ 위험조합: .. │
│ 주의조합: .. │
│ 시너지: ...  │
│ [차트]       │
└──────────────┘
```

**After:**
```
┌─────────────────────────────┐
│ [약물 카드 + 기본정보]      │
│ [약1: 타이레놀]            │
│ ├─ 효능: 해열진통          │
│ ├─ 복용: 12:00             │
│ └─ 상호작용: 2개           │
│                             │
│ [약2: 아스피린]            │
│ ├─ 효능: 항염진통          │
│ ├─ 복용: 07:00             │
│ └─ 상호작용: 1개           │
├─────────────────────────────┤
│ 🕸️ [상호작용 네트워크]     │
│  (시각적 노드/엣지)         │
├─────────────────────────────┤
│ ⏰ [복용 타임라인]          │
│ 07:00 아스피린   [위험도]   │
│ 12:00 타이레놀   [위험도]   │
│ 19:00 감기약     [위험도]   │
├─────────────────────────────┤
│ 🔴 [위험 조합] (상세)      │
│ 🟡 [주의 조합] (상세)      │
│ 🟢 [좋은 조합] (상세)      │
└─────────────────────────────┘
```

---

## 📋 구현 우선순위 (단계별)

### Phase 1: 성능 최적화 (1주일)
- [ ] Flash 모델 도입 (프롬프트 최적화)
- [ ] 병렬 처리 구조로 변경
- [ ] 스트리밍 분석 조기 시작 (지연 제거)

### Phase 2: Result2 시각화 개선 (1주일)
- [ ] 단계별 스트리밍 분해 (5단계 → 7단계)
- [ ] 음식-약물 상호작용 맵 추가
- [ ] Accordion 형식 UI 개선
- [ ] 성분별 위험도 칼럼 추가

### Phase 3: Medicine 페이지 개선 (2주일)
- [ ] 약물 상세 프로필 추가
- [ ] 스트리밍 분석 구현
- [ ] 네트워크 시각화 추가 (D3.js)
- [ ] 복용 시간표 기반 분석 추가

### Phase 4: 고급 기능 (선택사항)
- [ ] 복용 시간 최적화 제안
- [ ] 용량 기반 위험도 차등화
- [ ] 성분 겹침 상세 분석

---

## 🔧 기술 스택 추가

| 용도 | 현재 | 추천 |
|------|------|------|
| 네트워크 시각화 | 없음 | react-force-graph or D3.js |
| 타임라인 | 없음 | recharts timeline component |
| Accordion | 없음 | 직접 구현 or react-accessible-accordion |
| Flash 모델 | 없음 | gemini-1.5-flash (API 추가) |

---

## 📊 기대 효과

### 성능
- 분석 시간: 60초 → 12초 (80% 단축)
- 광고 시간 (10초) 동안 50% 이상 분석 완료
- 네트워크 지연 포함 최종 로딩: ~20초

### UX
- 시각 정보: 30% → 70% 증가
- 텍스트: 70% → 30% 감소
- 정보 이해도: +40% (예상)
- 사용자 만족도: +50% (추정)

### 기능성
- 약물 간 관계 명확화
- 복용 시간 고려한 상호작용 분석
- 개별 약물 프로필 상세화
- 스트리밍을 통한 과정 투명성

---

## 🎬 결론

**현재 문제:**
1. 느린 분석 (순차 처리 + Pro 모델)
2. 텍스트 위주 UI (시각화 부족)
3. 약물 분석 미흡 (단순 분류만)

**해결책:**
1. 병렬 처리 + Flash 모델 → 12초
2. 시각화 강화 + Accordion UI
3. 네트워크 분석 + 스트리밍 단계화

**기대 효과:**
- 사용자 경험 대폭 개선
- 분석 시간 80% 단축
- 정보 이해도 40% 향상
- 광고 시간 활용 최적화

