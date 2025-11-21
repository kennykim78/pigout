-- food_records 테이블 생성
CREATE TABLE IF NOT EXISTS food_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 인덱스 생성
CREATE INDEX idx_food_records_user_id ON food_records(user_id);
CREATE INDEX idx_food_records_created_at ON food_records(created_at DESC);

-- RLS (Row Level Security) 활성화
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 기록만 조회 가능
CREATE POLICY "Users can view own records" ON food_records
  FOR SELECT USING (true);

-- 모든 사용자가 삽입 가능
CREATE POLICY "Users can insert records" ON food_records
  FOR INSERT WITH CHECK (true);

-- 사용자가 자신의 기록만 업데이트 가능
CREATE POLICY "Users can update own records" ON food_records
  FOR UPDATE USING (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_food_records_updated_at
BEFORE UPDATE ON food_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
