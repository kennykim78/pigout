# Supabase 설정 가이드

## 1. SQL 스크립트 실행

1. Supabase Dashboard 접속: https://supabase.com/dashboard
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New Query** 클릭
5. `backend/supabase-setup.sql` 파일의 내용을 복사하여 붙여넣기
6. **Run** 버튼 클릭

## 2. 스토리지 버킷 생성

### 방법 1: Supabase Dashboard (권장)

1. Supabase Dashboard에서 **Storage** 메뉴 클릭
2. **New Bucket** 버튼 클릭
3. 설정:
   - **Name**: `food-images`
   - **Public bucket**: ✅ 체크 (공개 버킷으로 설정)
   - **File size limit**: 5MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
4. **Create bucket** 클릭
5. 생성된 버킷 클릭 → **Policies** 탭
6. **New Policy** 클릭 → **For full customization** 선택
7. 다음 정책 추가:

```sql
-- 모든 사용자가 업로드 가능
CREATE POLICY "Anyone can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'food-images');

-- 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read images"
ON storage.objects FOR SELECT
USING (bucket_id = 'food-images');
```

### 방법 2: SQL로 생성 (고급)

SQL Editor에서 실행:

```sql
-- 버킷이 이미 존재하는지 확인 후 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'food-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('food-images', 'food-images', true);
  END IF;
END $$;

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Anyone can upload to food-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read from food-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete from food-images" ON storage.objects;

-- 업로드 정책
CREATE POLICY "Anyone can upload to food-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'food-images');

-- 읽기 정책
CREATE POLICY "Anyone can read from food-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'food-images');

-- 삭제 정책 (선택사항)
CREATE POLICY "Anyone can delete from food-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'food-images');
```

## 3. 환경 변수 설정

`backend/.env` 파일 확인:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key (선택사항)
```

### Supabase 키 찾기:
1. Supabase Dashboard → **Settings** (톱니바퀴 아이콘)
2. **API** 탭
3. **Project URL** → `SUPABASE_URL`에 복사
4. **Project API keys** → `anon public` 키 → `SUPABASE_ANON_KEY`에 복사

## 4. 테스트

### 터미널에서 테스트:

```powershell
# 텍스트 분석 테스트
curl http://localhost:3001/api/food/text-analyze `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"foodName":"사과"}' `
  | ConvertFrom-Json

# 성공 응답 예시:
# {
#   "success": true,
#   "data": {
#     "id": "uuid...",
#     "foodName": "사과",
#     "score": 85,
#     "analysis": "사과에 대한 분석 결과입니다..."
#   }
# }
```

## 5. 문제 해결

### "new row violates row-level security policy" 오류

**원인**: RLS 정책이 설정되지 않았거나 잘못 설정됨

**해결책**:
1. SQL Editor에서 `supabase-setup.sql` 다시 실행
2. 테이블 RLS 정책 확인:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'food_analysis';
   ```
3. 정책이 없으면 수동으로 추가:
   ```sql
   CREATE POLICY "Enable all for food_analysis" 
   ON food_analysis 
   FOR ALL 
   USING (true) 
   WITH CHECK (true);
   ```

### 이미지 업로드 실패

**현재 상태**: 이미지 업로드 실패해도 분석은 계속 진행됩니다 (경고만 출력)

**완전한 해결**:
1. 위의 "2. 스토리지 버킷 생성" 단계 완료
2. 백엔드 재시작
3. 프론트엔드에서 이미지 업로드 재시도

## 6. 프로덕션 환경 설정

개발이 완료되면 RLS 정책을 실제 사용자 인증 기반으로 변경:

```sql
-- 인증된 사용자만 삽입 가능
CREATE POLICY "Authenticated users can insert" 
ON food_analysis FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 자신의 데이터만 조회 가능
CREATE POLICY "Users can view own data" 
ON food_analysis FOR SELECT 
USING (auth.uid() = user_id);
```

## 완료!

모든 설정이 완료되면:
1. 백엔드 서버 재시작: `cd backend && npm run start:dev`
2. 프론트엔드에서 음식 분석 테스트
3. 이미지 업로드 및 저장 확인
