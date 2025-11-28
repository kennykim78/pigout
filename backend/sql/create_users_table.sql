-- =============================================
-- PIGOUT 사용자 테이블 생성 스크립트
-- =============================================

-- 1. users 테이블 생성
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  nickname VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  diseases TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. device_id 인덱스 생성 (빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);

-- 3. email 인덱스 생성 (이후 이메일 인증용)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. phone 인덱스 생성 (이후 휴대폰 인증용)
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 5. food_analysis 테이블에 user_id 컬럼 추가 (이미 있으면 무시)
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 6. food_analysis user_id 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_food_analysis_user_id ON food_analysis(user_id);

-- 7. medicine_records 테이블의 user_id 외래키 설정 (이미 있으면 무시)
-- 주의: 기존 medicine_records.user_id가 users 테이블과 연결되어 있지 않을 수 있음
-- ALTER TABLE medicine_records 
-- ADD CONSTRAINT fk_medicine_records_user 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 8. RLS (Row Level Security) 정책 설정 (선택사항)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 실행 후 확인 쿼리
-- =============================================
-- SELECT * FROM users LIMIT 10;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';
