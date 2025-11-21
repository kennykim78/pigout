# 먹어도돼지? API 문서

## 📌 Base URL
```
http://localhost:3001/api
```

## 🔐 인증
현재는 테스트용으로 userId를 하드코딩하고 있습니다.
프로덕션에서는 JWT 또는 Supabase Auth를 사용하세요.

---

## 📍 음식 분석 API

### 1. 이미지 기반 음식 분석
```http
POST /api/food/analyze
Content-Type: multipart/form-data

Body:
- foodName: string
- image: File
```

**Response:**
```json
{
  "foodName": "김치찌개",
  "imageUrl": "https://...",
  "score": 33,
  "grade": "D",
  "summary": "..."
}
```

### 2. 텍스트 기반 음식 분석
```http
POST /api/food/text-analyze
Content-Type: application/json

{
  "foodName": "김치찌개"
}
```

---

## 💊 약 관리 API

### 1. QR 코드 스캔
```http
POST /api/medicine/scan-qr

{
  "qrData": "품목명: 타이레놀 500mg\n업체명: Johnson & Johnson\n품목기준코드: 8806429021102",
  "dosage": "1정",
  "frequency": "하루 3회"
}
```

**Response:**
```json
{
  "success": true,
  "medicineRecord": {
    "id": "uuid",
    "medicine_name": "타이레놀 500mg",
    "dosage": "1정",
    "frequency": "하루 3회"
  },
  "parsedInfo": {
    "medicineName": "타이레놀 500mg",
    "manufacturer": "Johnson & Johnson",
    "medicineCode": "8806429021102"
  }
}
```

### 2. 약품 검색
```http
POST /api/medicine/search

{
  "keyword": "타이레놀",
  "limit": 20
}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "타이레놀 500mg",
    "manufacturer": "Johnson & Johnson",
    "purpose": "해열, 진통",
    "side_effects": "드물게 간 손상..."
  }
]
```

### 3. 내 약 목록 조회
```http
GET /api/medicine/my-list?active=true
```

**Response:**
```json
[
  {
    "id": "uuid",
    "medicine_name": "타이레놀 500mg",
    "dosage": "1정",
    "frequency": "하루 3회",
    "is_active": true,
    "created_at": "2025-11-17T..."
  }
]
```

### 4. 약-음식 상호작용 분석
```http
POST /api/medicine/analyze-interaction

{
  "medicineIds": ["uuid1", "uuid2"],
  "foodName": "김치찌개"
}
```

**Response:**
```json
{
  "foodName": "김치찌개",
  "medicineCount": 2,
  "interactions": [
    {
      "medicine": "타이레놀 500mg",
      "riskLevel": "safe",
      "description": "상호작용 없음"
    }
  ],
  "hasRisk": false
}
```

### 5. 약 기록 수정
```http
PATCH /api/medicine/:id

{
  "is_active": false,
  "dosage": "2정"
}
```

### 6. 약 기록 삭제
```http
DELETE /api/medicine/:id
```

---

## 🎁 리워드 API

### 1. 포인트 조회
```http
GET /api/reward/points
```

**Response:**
```json
{
  "currentPoints": 150,
  "lifetimeEarned": 500,
  "lifetimeSpent": 350
}
```

### 2. 교환 가능 상품 목록
```http
GET /api/reward/items
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "스타벅스 아메리카노 Tall",
    "brand": "Starbucks",
    "point_cost": 50,
    "description": "...",
    "image_url": "https://...",
    "is_available": true
  }
]
```

### 3. 리워드 교환
```http
POST /api/reward/claim

{
  "rewardId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "rewardName": "스타벅스 아메리카노 Tall",
  "pointsSpent": 50,
  "remainingPoints": 100
}
```

### 4. 포인트 내역
```http
GET /api/reward/history?type=earn&limit=50&offset=0
```

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "earn",
    "points": 10,
    "reason": "daily_85",
    "reference_date": "2025-11-17",
    "balance_after": 150,
    "created_at": "2025-11-17T..."
  }
]
```

---

## 📊 통계 API

### 1. 일별 점수 조회
```http
GET /api/stats/daily?date=2025-11-17
```

**Response:**
```json
{
  "date": "2025-11-17",
  "dailyScore": {
    "food_count": 3,
    "food_avg_score": 75,
    "combined_count": 1,
    "combined_avg_score": 80,
    "points_earned": 10,
    "point_rule_applied": "daily_85"
  },
  "foodRecords": [...],
  "combinedRecords": [...]
}
```

### 2. 월별 통계 조회
```http
GET /api/stats/monthly?year=2025&month=11
```

**Response:**
```json
{
  "year": 2025,
  "month": 11,
  "monthlyScore": {
    "total_days": 17,
    "avg_score": 78,
    "best_score": 95,
    "worst_score": 60,
    "total_points_earned": 120,
    "days_above_70": 15,
    "days_above_85": 8
  },
  "dailyScores": [...]
}
```

### 3. 전체 요약 통계
```http
GET /api/stats/summary
```

**Response:**
```json
{
  "totalRecords": 52,
  "avgScore30Days": 78,
  "recentDays": 17
}
```

### 4. 일별 점수 재계산
```http
POST /api/stats/calculate-daily?date=2025-11-17
```

---

## 🤖 AI 종합 분석 API (신규)

### 음식 + 약물 + 영양제 종합 분석
```http
POST /api/ai/analyze-combined

{
  "foodName": "김치찌개",
  "medicines": ["uuid1", "uuid2"],
  "supplements": ["비타민C", "오메가3"],
  "diseases": ["diabetes", "hypertension"],
  "imageUrl": "https://..."
}
```

**Response:**
```json
{
  "flashAnalysis": {
    "score": 65,
    "grade": "D",
    "risks": ["높은 나트륨", "포화지방", "약물 상호작용"],
    "recommendationLevel": "caution"
  },
  "proAnalysis": {
    "detailedReason": "...",
    "interactions": [
      {
        "medicine": "타이레놀",
        "riskLevel": "safe",
        "description": "..."
      }
    ],
    "nutritionGuidance": "...",
    "recommendations": ["...", "..."],
    "globalRemedies": {
      "Korea": "뽕잎차",
      "China": "산사",
      "India": "호로파",
      "USA": "DASH 식단"
    }
  },
  "overallScore": 65,
  "savedRecordId": "uuid"
}
```

---

## 📋 포인트 정책

### 일일 포인트 적립 조건
- **평균 70점 이상**: 5포인트
- **평균 85점 이상**: 10포인트

### 포인트 계산 시점
- 매일 자정에 자동 계산
- 또는 사용자가 직접 `/api/stats/calculate-daily` 호출

---

## 🔄 워크플로우 예시

### 1. 음식 분석 + 약물 상호작용 체크
```javascript
// 1. 음식 분석
const foodResult = await analyzeFoodByText('김치찌개');

// 2. 내 약 목록 조회
const medicines = await getMyMedicines();

// 3. 상호작용 분석
const interaction = await analyzeMedicineInteraction(
  medicines.map(m => m.id),
  '김치찌개'
);

// 4. 종합 분석 (AI)
const combined = await analyzeCombined({
  foodName: '김치찌개',
  medicines: medicines.map(m => m.id),
  diseases: ['diabetes', 'hypertension']
});
```

### 2. 일일 점수 확인 및 포인트 획득
```javascript
// 1. 오늘 점수 조회
const dailyScore = await getDailyScore();

// 2. 포인트 획득 여부 확인
if (dailyScore.dailyScore.points_earned > 0) {
  alert(`${dailyScore.dailyScore.points_earned}P 획득!`);
}

// 3. 포인트 조회
const points = await getRewardPoints();
console.log('보유 포인트:', points.currentPoints);
```

### 3. 리워드 교환
```javascript
// 1. 교환 가능 상품 조회
const items = await getRewardItems();

// 2. 상품 교환
const result = await claimReward(selectedItemId);

// 3. 내역 확인
const history = await getRewardHistory();
```

---

## 🚀 시작하기

### 백엔드 실행
```bash
cd backend
npm install
npm run dev
```

### 프론트엔드 실행
```bash
cd 251112_pigout
npm install
npm run dev
```

### 환경 변수 설정
```env
# Backend .env
GEMINI_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key

# Frontend .env
VITE_API_URL=http://localhost:3001/api
```

---

## 📝 주의사항

1. **인증**: 현재는 테스트용 하드코딩. 프로덕션에서는 Supabase Auth 사용
2. **Rate Limiting**: Gemini API는 분당 요청 제한 있음 (2초 딜레이 권장)
3. **이미지 저장**: Supabase Storage 사용
4. **CORS**: 프론트엔드 Origin 허용 필요

---

## 🔧 개발 팁

### Gemini 프롬프트 최적화
- **Flash**: 빠른 평가, 점수 계산 (1초)
- **Pro**: 상세 분석, 글로벌 대체 식품 (3초)

### 포인트 시스템
- `daily_scores` 테이블로 일별 집계
- `reward_history`로 트랜잭션 관리
- Cron Job으로 자정 자동 계산

### 약물 상호작용
- 기본: `medicine_list.food_interactions` 체크
- 고급: Gemini Pro로 AI 분석

