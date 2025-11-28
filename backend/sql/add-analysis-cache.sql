-- ================================================================
-- 분석 결과 캐싱 및 상세 정보 저장을 위한 스키마 업데이트
-- ================================================================

-- 1. food_analysis 테이블에 상세 분석 및 약물 정보 컬럼 추가
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS detailed_analysis JSONB,
ADD COLUMN IF NOT EXISTS medicines TEXT[],
ADD COLUMN IF NOT EXISTS analysis_mode VARCHAR(20) DEFAULT 'quick-ai';

-- 인덱스 추가 (캐시 조회용)
CREATE INDEX IF NOT EXISTS idx_food_analysis_cache 
ON food_analysis(food_name, diseases, medicines) 
WHERE detailed_analysis IS NOT NULL;

-- 2. 분석 결과 캐시 테이블 (음식+질병+약물 조합별 캐싱)
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 캐시 키 (음식명 + 질병 + 약물 조합의 해시)
  cache_key VARCHAR(64) UNIQUE NOT NULL,
  
  -- 원본 데이터
  food_name VARCHAR(255) NOT NULL,
  diseases TEXT[] DEFAULT '{}',
  medicines TEXT[] DEFAULT '{}',
  
  -- 분석 결과
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  analysis TEXT,
  detailed_analysis JSONB,
  
  -- AI 모델 정보
  model_version VARCHAR(50) DEFAULT 'gemini-2.0-flash',
  analysis_mode VARCHAR(20) DEFAULT 'quick-ai',
  
  -- 사용 통계
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  
  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- 캐시 키 인덱스
CREATE INDEX IF NOT EXISTS idx_analysis_cache_key ON analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_food ON analysis_cache(food_name);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires ON analysis_cache(expires_at);

-- 3. 캐시 히트 업데이트 함수
CREATE OR REPLACE FUNCTION update_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE analysis_cache 
  SET hit_count = hit_count + 1, 
      last_hit_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 만료된 캐시 자동 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM analysis_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. 캐시 통계 뷰
CREATE OR REPLACE VIEW cache_statistics AS
SELECT 
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  COUNT(CASE WHEN hit_count > 0 THEN 1 END) as entries_with_hits,
  COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_entries
FROM analysis_cache;

-- 6. 인기 음식 분석 뷰 (캐시 재사용률 높은 음식)
CREATE OR REPLACE VIEW popular_food_analysis AS
SELECT 
  food_name,
  array_agg(DISTINCT unnest(diseases)) as common_diseases,
  SUM(hit_count) as total_hits,
  COUNT(*) as variation_count,
  MAX(created_at) as last_analyzed
FROM analysis_cache
GROUP BY food_name
ORDER BY total_hits DESC
LIMIT 100;

-- ================================================================
-- 완료
-- ================================================================
COMMENT ON TABLE analysis_cache IS '음식+질병+약물 조합별 AI 분석 결과 캐시. 30일 후 자동 만료.';
COMMENT ON COLUMN analysis_cache.cache_key IS 'MD5(food_name + sorted(diseases) + sorted(medicines))';
COMMENT ON COLUMN analysis_cache.hit_count IS '캐시 재사용 횟수 (비용 절감 측정용)';
