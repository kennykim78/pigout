-- 약물 상호작용 분석 결과 캐시 테이블
CREATE TABLE IF NOT EXISTS medicine_analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medicine_ids TEXT NOT NULL,  -- 정렬된 약품 ID 목록 (쉼표 구분)
  age INTEGER,
  gender TEXT,
  analysis_result JSONB NOT NULL,  -- 전체 분석 결과
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_medicine_analysis_cache_key ON medicine_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_medicine_analysis_user_id ON medicine_analysis_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_analysis_created_at ON medicine_analysis_cache(created_at);

-- 7일 이상 된 캐시 자동 삭제 함수 (선택적)
CREATE OR REPLACE FUNCTION delete_old_medicine_analysis_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM medicine_analysis_cache
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 설명 추가
COMMENT ON TABLE medicine_analysis_cache IS '약물 상호작용 분석 결과 캐시 - 동일 조건 재사용';
COMMENT ON COLUMN medicine_analysis_cache.cache_key IS '캐시 키: medicine_ids + age + gender';
COMMENT ON COLUMN medicine_analysis_cache.medicine_ids IS '정렬된 약품 ID 목록';
COMMENT ON COLUMN medicine_analysis_cache.analysis_result IS '전체 분석 결과 JSON';
