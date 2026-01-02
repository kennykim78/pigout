-- 사용자 테이블에 나이(age)와 성별(gender) 컬럼 추가
-- 실행 위치: Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- 확인
-- SELECT * FROM users;
