# Pigout Backend

NestJS + Supabase 기반 백엔드 서버

## 📁 프로젝트 구조

```
pigout-backend/
├── src/
│   ├── main.ts              # 애플리케이션 엔트리 포인트
│   ├── app.module.ts        # 루트 모듈
│   ├── food/                # 음식 분석 모듈
│   │   ├── food.controller.ts
│   │   ├── food.service.ts
│   │   └── food.module.ts
│   └── supabase/            # Supabase 연동 모듈
│       ├── supabase.service.ts
│       └── supabase.module.ts
├── .env                     # 환경 변수
├── tsconfig.json            # TypeScript 설정
└── package.json
```

## 🚀 시작하기

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 2. Supabase 설정

Supabase 대시보드에서 다음 테이블을 생성하세요:

#### `food_analysis` 테이블

```sql
CREATE TABLE food_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  food_name TEXT NOT NULL,
  image_url TEXT,
  score INTEGER,
  analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Storage Bucket 생성

1. Supabase 대시보드 → Storage → "New bucket"
2. Bucket 이름: `food-images`
3. Public bucket으로 설정

### 3. 서버 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

서버는 `http://localhost:3001`에서 실행됩니다.

## 📡 API 엔드포인트

### POST /api/food/analyze
이미지와 함께 음식 분석

**Request:**
- `foodName` (string): 음식 이름
- `image` (file): 음식 이미지

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "foodName": "김치찌개",
    "imageUrl": "https://...",
    "score": 85,
    "analysis": "분석 결과..."
  }
}
```

### POST /api/food/text-analyze
텍스트만으로 음식 분석

**Request:**
```json
{
  "foodName": "김치찌개"
}
```

### GET /api/food/:id
음식 분석 결과 조회

## 🔧 개발 도구

- **NestJS**: Node.js 프레임워크
- **Supabase**: 데이터베이스 & 스토리지
- **TypeScript**: 타입 안정성
- **Multer**: 파일 업로드

## 📝 다음 단계

1. ✅ Supabase 프로젝트 생성 및 설정
2. ✅ NestJS 백엔드 구조 설정
3. ⬜ AI/ML 모델 연동 (음식 분석)
4. ⬜ 사용자 인증 추가
5. ⬜ 건강 정보 관리 기능
