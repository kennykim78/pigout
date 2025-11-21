# 먹어도돼지? (PigOut) - 확장 아키텍처 설계

## 📐 프로젝트 개요

### 핵심 기술 스택
- **Frontend**: React 18.3.1 + Vite + React Router + Zustand
- **Backend**: NestJS (별도 프로젝트 pigout-backend)
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **AI**: Google Gemini 2.5 Flash + Pro
- **Style**: SCSS + Pretendard 폰트

### 디자인 시스템
```scss
// Primary Colors
$color-primary-yellow: rgb(255, 223, 62);  // 메인 배경
$color-primary-red: rgb(241, 84, 84);      // 위험/나쁨
$color-primary-orange: rgb(255, 161, 0);   // 경고/좋음
$color-black: rgb(0, 0, 0);                // 텍스트
$color-white: rgb(255, 255, 255);          // 카드 배경

// Typography
$font-family: 'Pretendard', sans-serif;
$font-size-score: 96px;
$font-size-massive: 70px;
$font-size-huge: 62px;
```

---

## 🗂️ 전체 폴더 구조

### Frontend (251112_pigout)
```
251112_pigout/
├── src/
│   ├── assets/
│   │   └── images/           # 이미지 리소스
│   ├── components/
│   │   ├── BottomNav.jsx     # ✨ 신규: 하단 네비게이션바
│   │   ├── RecommendationCard.jsx
│   │   └── ...
│   ├── layout/
│   │   └── MainLayout.jsx    # ✨ 신규: 공통 레이아웃
│   ├── pages/
│   │   ├── IntroSplash.jsx
│   │   ├── SelectOption.jsx
│   │   ├── Main.jsx          # Home (음식 분석)
│   │   ├── Medicine.jsx      # ✨ 신규: 약 입력 페이지
│   │   ├── History.jsx       # 기록 (확장)
│   │   ├── Reward.jsx        # ✨ 신규: 리워드 페이지
│   │   ├── MyPage.jsx        # ✨ 신규: 마이페이지
│   │   ├── Result01.jsx      # 결과 페이지 (확장)
│   │   └── Result2.jsx
│   ├── services/
│   │   └── api.ts            # API 클라이언트 (확장)
│   ├── store/
│   │   ├── authStore.js      # ✨ 신규: 사용자 상태
│   │   ├── medicineStore.js  # ✨ 신규: 약 상태
│   │   └── rewardStore.js    # ✨ 신규: 리워드 상태
│   ├── styles/
│   │   ├── _variables.scss
│   │   └── _mixins.scss
│   └── App.jsx               # 라우팅 재구성
```

### Backend (c:\kenny_work\pigout-backend)
⚠️ **주의**: 백엔드는 워크스페이스 외부에 위치합니다.

```
pigout-backend/
├── src/
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai.service.ts     # 확장: analyzeCombined 추가
│   │   ├── ai.controller.ts
│   │   ├── dtos/
│   │   │   └── analyze-combined.dto.ts  # ✨ 신규
│   │   └── utils/
│   │       ├── gemini.client.ts          # 확장
│   │       └── medicine-interaction.ts   # ✨ 신규
│   ├── medicine/             # ✨ 신규 모듈
│   │   ├── medicine.module.ts
│   │   ├── medicine.service.ts
│   │   ├── medicine.controller.ts
│   │   ├── dtos/
│   │   │   ├── scan-qr.dto.ts
│   │   │   └── search-medicine.dto.ts
│   │   └── utils/
│   │       └── qr-parser.ts
│   ├── reward/               # ✨ 신규 모듈
│   │   ├── reward.module.ts
│   │   ├── reward.service.ts
│   │   ├── reward.controller.ts
│   │   └── dtos/
│   │       ├── claim-reward.dto.ts
│   │       └── point-history.dto.ts
│   ├── stats/                # ✨ 신규 모듈
│   │   ├── stats.module.ts
│   │   ├── stats.service.ts
│   │   ├── stats.controller.ts
│   │   └── dtos/
│   │       ├── daily-score.dto.ts
│   │       └── monthly-report.dto.ts
│   ├── supabase/
│   │   ├── supabase.module.ts
│   │   └── supabase.service.ts
│   └── app.module.ts
```

---

## 🎯 신규 기능 상세 설계

### 1️⃣ Gift Show 리워드 시스템

#### 포인트 정책
```typescript
interface PointPolicy {
  dailyAvgScore70: 5,   // 70점 이상
  dailyAvgScore85: 10,  // 85점 이상
}
```

#### 교환 가능 상품
```typescript
interface RewardItem {
  id: string;
  name: string;
  brand: 'GiftShow' | 'CU' | 'Starbucks';
  pointCost: number;
  imageUrl: string;
}
```

### 2️⃣ 하단 네비게이션바

```typescript
const navItems = [
  { path: '/main', label: 'Home', icon: '🏠' },
  { path: '/medicine', label: '약', icon: '💊' },
  { path: '/history', label: '기록', icon: '📊' },
  { path: '/reward', label: '리워드', icon: '🎁' },
  { path: '/mypage', label: 'My', icon: '👤' },
];
```

### 3️⃣ 약 입력 및 상호작용 분석

#### QR 코드 형식
```
의약품안전나라 QR 코드:
품목명: {약명}
업체명: {제조사}
품목기준코드: {코드}
```

#### 상호작용 분석 로직
```typescript
// Gemini Pro를 활용한 약-음식 상호작용 분석
interface MedicineInteraction {
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  interactionDescription: string;
  recommendations: string[];
}
```

---

## 🗄️ 데이터베이스 스키마

### 신규 테이블 목록
1. `medicine_records` - 복용 약 기록
2. `combined_records` - 음식+약 종합 분석
3. `rewards` - 교환 가능 상품 목록
4. `reward_history` - 포인트 적립/사용 내역
5. `medicine_list` - 약품 정보 마스터
6. `daily_scores` - 일별 점수 집계
7. `monthly_scores` - 월별 통계

---

## 🔌 API 엔드포인트 설계

### AI Module (확장)
```
POST   /api/ai/analyze-combined
       Body: { foodName, medicines[], supplements[], diseases[] }
       Response: { score, grade, interactions[], detailedAnalysis }
```

### Medicine Module (신규)
```
POST   /api/medicine/scan-qr
       Body: { qrData }
       
POST   /api/medicine/search
       Query: { keyword }
       
GET    /api/medicine/my-list
       
POST   /api/medicine/analyze-interaction
       Body: { medicineIds[], foodName }
```

### Reward Module (신규)
```
GET    /api/reward/points
       Response: { totalPoints, history[] }
       
GET    /api/reward/items
       Response: { items[] }
       
POST   /api/reward/claim
       Body: { itemId }
       
GET    /api/reward/history
```

### Stats Module (신규)
```
GET    /api/stats/daily?date=2025-11-17
       Response: { date, avgScore, foodRecords[], medicineRecords[] }
       
GET    /api/stats/monthly?year=2025&month=11
       Response: { dailyScores[], avgScore, pointsEarned }
       
GET    /api/stats/summary
       Response: { totalRecords, avgScore30Days, currentStreak }
```

---

## 🤖 Gemini 프롬프트 최적화

### Flash vs Pro 사용 전략

#### Gemini Flash (빠른 분석)
- 용도: 실시간 간단 평가, 점수 계산
- 최대 토큰: 1000 입력 / 500 출력
- 응답 시간: ~1초

```typescript
const flashPrompt = `
음식: ${foodName}
복용약: ${medicines.join(', ')}
질병: ${diseases.join(', ')}

위 조합의 적합도를 0-100 점수로 평가하고, 
주요 위험 요소 3가지를 간단히 나열하세요.

JSON 형식:
{
  "score": number,
  "risks": ["위험1", "위험2", "위험3"]
}
`;
```

#### Gemini Pro (상세 분석)
- 용도: 상세 건강 조언, 글로벌 치료법 추천
- 최대 토큰: 3000 입력 / 2000 출력
- 응답 시간: ~3초

```typescript
const proPrompt = `
당신은 의약학과 영양학을 전문으로 하는 AI 헬스케어 어드바이저입니다.

[분석 대상]
음식: ${foodName}
복용중인 약물: ${medicines.map(m => `${m.name} (${m.purpose})`).join(', ')}
기저질환: ${diseases.join(', ')}

[분석 요청사항]
1. 약물-음식 상호작용 위험도 평가
2. 질병별 영양학적 적합성 분석
3. 구체적인 섭취 가이드 (양, 시간, 조리법)
4. 한국, 중국, 인도, 미국 전통 대체 식품 추천

JSON 형식으로 응답:
{
  "detailedReason": "상세 분석 (400자)",
  "interactions": [
    {
      "medicine": "약명",
      "riskLevel": "safe|caution|warning|danger",
      "description": "상호작용 설명"
    }
  ],
  "nutritionGuidance": "영양 가이드 (300자)",
  "recommendations": ["추천사항1", "추천사항2"],
  "globalRemedies": {
    "Korea": "한국 대체식품",
    "China": "중국 대체식품",
    "India": "인도 대체식품",
    "USA": "미국 대체식품"
  }
}
`;
```

---

## 📱 UI/UX 플로우

### 메인 사용자 여정

```
1. 앱 시작
   └─> IntroSplash → SelectOption (질병 선택)

2. 음식 분석
   └─> Main (카메라/음성) → Result01 (간단 평가) → Result2 (상세)

3. 약 입력
   └─> Medicine (QR 스캔/검색) → 약 목록 저장

4. 기록 확인
   └─> History (일별) → 월별 통계 → 달력 뷰

5. 리워드
   └─> Reward (포인트 확인) → 상품 교환 → 교환 내역

6. 마이페이지
   └─> MyPage (프로필, 설정, 로그아웃)
```

---

## 🔐 보안 및 인증

### Row Level Security (RLS) 정책
```sql
-- 모든 테이블에 사용자별 접근 제어
ALTER TABLE medicine_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own medicine records"
ON medicine_records FOR ALL
USING (auth.uid() = user_id);
```

---

## 🚀 배포 전략

### 환경 변수
```env
# Frontend (.env)
VITE_API_URL=http://localhost:3001/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Backend (.env)
GEMINI_API_KEY=AIzaSy...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
PORT=3001
```

### 빌드 및 실행
```bash
# Frontend
cd 251112_pigout
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드

# Backend
cd pigout-backend
npx ts-node src/main.ts  # 개발 서버
npm run build        # 프로덕션 빌드
```

---

## 📊 성능 최적화

### API 호출 최적화
- Gemini Flash: 일반 분석 (1초 이내)
- Gemini Pro: 상세 분석 (3초 이내, 필요시에만)
- Supabase 쿼리: 인덱스 최적화, JOIN 최소화

### 프론트엔드 최적화
- React.lazy() + Suspense로 코드 스플리팅
- Zustand로 불필요한 리렌더링 방지
- 이미지 최적화 (WebP, lazy loading)

---

이 아키텍처를 기반으로 순차적으로 구현을 진행합니다.
