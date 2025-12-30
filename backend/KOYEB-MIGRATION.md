# Railway에서 Koyeb으로 마이그레이션 가이드

## 1. Koyeb 계정 생성 및 설정

1. [Koyeb](https://www.koyeb.com/) 가입 (GitHub 연동 권장)
2. 무료 플랜: 월 $5.5 크레딧 제공 (Nano 인스턴스 무료 운영 가능)

---

## 2. Koyeb 앱 생성 방법

### 방법 A: GitHub 연동 (권장)

1. Koyeb 대시보드 → **Create App**
2. **GitHub** 선택
3. Repository: `kennykim78/pigout` 선택
4. **Branch**: `main`
5. **Root directory**: `backend` (중요!)
6. **Builder**: Dockerfile
7. **Instance type**: Nano (무료)
8. **Region**: Tokyo (Asia) 권장

### 방법 B: Docker 직접 배포

```bash
# 로컬에서 Docker 빌드 테스트
cd backend
docker build -t pigout-backend .
docker run -p 3001:3001 --env-file .env pigout-backend
```

---

## 3. 환경 변수 설정 (필수!)

Koyeb 앱 설정 → **Environment variables**에서 다음 변수들을 추가:

```
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server
PORT=3001
NODE_ENV=production

# CORS (프론트엔드 URL)
FRONTEND_URL=https://your-frontend-url.vercel.app

# AI
GEMINI_API_KEY=your_gemini_api_key

# OpenData API Keys
MFDS_API_KEY=your_mfds_api_key
RECIPE_DB_API_KEY=your_recipe_db_api_key

# 선택적
UNSPLASH_ACCESS_KEY=your_unsplash_key
GOOGLE_SEARCH_API_KEY=your_google_search_key
GOOGLE_SEARCH_CX=your_google_cx
```

> ⚠️ Railway에서 사용하던 환경 변수를 그대로 복사하세요!

---

## 4. 포트 설정

Koyeb은 기본적으로 `PORT` 환경 변수를 자동 설정합니다.
`backend/src/main.ts`에서 `process.env.PORT`를 사용하고 있는지 확인하세요.

---

## 5. 헬스체크 설정

Koyeb 앱 설정에서:
- **Health check path**: `/` 또는 `/health` (있다면)
- **Port**: `3001`

---

## 6. 프론트엔드 API URL 업데이트

배포 완료 후 Koyeb에서 제공하는 URL을 확인하고, 
프론트엔드의 API URL을 업데이트하세요:

### `src/services/api.ts` 수정 예시:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-app-name.koyeb.app';
```

### Vercel 환경 변수 (프론트엔드가 Vercel에 있다면):
```
VITE_API_URL=https://your-app-name.koyeb.app
```

---

## 7. 배포 확인

1. Koyeb 대시보드에서 **Logs** 탭 확인
2. 배포된 URL로 접속하여 API 동작 확인
3. 프론트엔드에서 백엔드 연결 테스트

---

## 8. Railway 서비스 종료

이관 완료 후:
1. Railway 대시보드 → 해당 프로젝트
2. Settings → Danger Zone → Delete Service

---

## 트러블슈팅

### sharp 라이브러리 오류
Dockerfile에서 `vips-dev` 패키지가 설치되어 있어야 합니다.
이미 포함되어 있음!

### 빌드 실패
- `npm install --legacy-peer-deps` 사용
- Node 20 버전 확인

### CORS 오류
환경 변수에서 `FRONTEND_URL`이 정확한지 확인하세요.
