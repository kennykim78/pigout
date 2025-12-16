-- ============================================
-- 1. 테이블 생성
-- ============================================

-- food_analysis 테이블 (음식 분석 결과)
CREATE TABLE IF NOT EXISTS food_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  food_name TEXT NOT NULL,
  image_url TEXT,
  score INTEGER,
  analysis TEXT,
  diseases TEXT[], -- 질병 정보 배열
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- food_records 테이블 (기존)
CREATE TABLE IF NOT EXISTS food_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  food_name VARCHAR(255) NOT NULL,
  image_path TEXT,
  detected_label VARCHAR(255),
  confidence DECIMAL(3, 2),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  summary_json JSONB,
  detailed_analysis_json JSONB,
  diseases TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- medicine_records 테이블 (약물 정보)
CREATE TABLE IF NOT EXISTS medicine_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ingredients TEXT[] DEFAULT '{}',
  drug_class TEXT,
  dosage TEXT,
  frequency TEXT,
  start_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  qr_code_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- disease_enhanced_info 테이블 (질병별 강화 정보 - 미리 생성하여 캐싱)
CREATE TABLE IF NOT EXISTS disease_enhanced_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  chronic_type TEXT,
  tags TEXT[] DEFAULT '{}',
  recommended_foods TEXT[] DEFAULT '{}',
  avoid_foods TEXT[] DEFAULT '{}',
  caution_foods TEXT[] DEFAULT '{}',
  dietary_reason TEXT,
  key_nutrients JSONB,
  complication_risks TEXT[] DEFAULT '{}',
  general_precautions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_food_analysis_created_at ON food_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_records_user_id ON food_records(user_id);
CREATE INDEX IF NOT EXISTS idx_food_records_created_at ON food_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medicine_records_user_id ON medicine_records(user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_records_is_active ON medicine_records(is_active);
CREATE INDEX IF NOT EXISTS idx_disease_enhanced_info_name ON disease_enhanced_info(disease_name);

-- ============================================
-- 3. RLS (Row Level Security) 설정
-- ============================================

-- food_analysis 테이블 RLS
ALTER TABLE food_analysis ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Enable read access for all users" ON food_analysis;
DROP POLICY IF EXISTS "Enable insert for all users" ON food_analysis;
DROP POLICY IF EXISTS "Enable update for all users" ON food_analysis;

-- 모든 사용자가 조회 가능 (개발 환경용)
CREATE POLICY "Enable read access for all users" 
ON food_analysis FOR SELECT 
USING (true);

-- 모든 사용자가 삽입 가능 (개발 환경용)
CREATE POLICY "Enable insert for all users" 
ON food_analysis FOR INSERT 
WITH CHECK (true);

-- 모든 사용자가 업데이트 가능 (개발 환경용)
CREATE POLICY "Enable update for all users" 
ON food_analysis FOR UPDATE 
USING (true);

-- food_records 테이블 RLS
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Enable read access for all users on food_records" ON food_records;
DROP POLICY IF EXISTS "Enable insert for all users on food_records" ON food_records;
DROP POLICY IF EXISTS "Enable update for all users on food_records" ON food_records;

CREATE POLICY "Enable read access for all users on food_records" 
ON food_records FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for all users on food_records" 
ON food_records FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for all users on food_records" 
ON food_records FOR UPDATE 
USING (true);

-- medicine_records 테이블 RLS
ALTER TABLE medicine_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Enable read access for all users on medicine_records" ON medicine_records;
DROP POLICY IF EXISTS "Enable insert for all users on medicine_records" ON medicine_records;
DROP POLICY IF EXISTS "Enable update for all users on medicine_records" ON medicine_records;
DROP POLICY IF EXISTS "Enable delete for all users on medicine_records" ON medicine_records;

CREATE POLICY "Enable read access for all users on medicine_records" 
ON medicine_records FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for all users on medicine_records" 
ON medicine_records FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for all users on medicine_records" 
ON medicine_records FOR UPDATE 
USING (true);

CREATE POLICY "Enable delete for all users on medicine_records" 
ON medicine_records FOR DELETE 
USING (true);

-- disease_enhanced_info 테이블 RLS (읽기 전용 - 관리자만 수정)
ALTER TABLE disease_enhanced_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users on disease_enhanced_info" ON disease_enhanced_info;

CREATE POLICY "Enable read access for all users on disease_enhanced_info" 
ON disease_enhanced_info FOR SELECT 
USING (true);

-- ============================================
-- 4. 스토리지 버킷 생성 (SQL Editor에서는 실행 불가, Dashboard에서 수동 설정 필요)
-- ============================================

-- Supabase Dashboard > Storage 에서 수동으로 생성:
-- 1. 버킷 이름: food-images
-- 2. Public 버킷으로 설정
-- 3. 허용 파일 타입: image/jpeg, image/png, image/webp
-- 4. 최대 파일 크기: 5MB

-- 또는 아래 정책을 추가 (버킷 생성 후):
-- RLS 정책: 모든 사용자가 업로드/읽기 가능

-- ============================================
-- 5. updated_at 자동 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_food_records_updated_at ON food_records;
DROP TRIGGER IF EXISTS update_medicine_records_updated_at ON medicine_records;

CREATE TRIGGER update_food_records_updated_at
BEFORE UPDATE ON food_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicine_records_updated_at
BEFORE UPDATE ON medicine_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '테이블 및 RLS 정책 설정 완료!';
  RAISE NOTICE '다음 단계:';
  RAISE NOTICE '1. Supabase Dashboard > Storage로 이동';
  RAISE NOTICE '2. "New Bucket" 클릭';
  RAISE NOTICE '3. 버킷 이름: food-images';
  RAISE NOTICE '4. Public 버킷으로 설정 (체크박스 선택)';
  RAISE NOTICE '5. 저장';
END $$;
