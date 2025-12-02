-- 의약품 검색 결과 캐시 테이블
-- API 호출을 줄이고 응답 속도를 향상시키기 위한 캐시 시스템

CREATE TABLE IF NOT EXISTS medicine_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  search_keyword TEXT NOT NULL UNIQUE,  -- 검색 키워드 (소문자 정규화)
  results JSONB NOT NULL,                -- 검색 결과 배열
  result_count INTEGER DEFAULT 0,        -- 결과 개수
  source TEXT,                           -- 데이터 출처 (e약은요, 의약품허가, 건강기능식품, AI생성)
  hit_count INTEGER DEFAULT 0,           -- 캐시 히트 횟수
  last_hit_at TIMESTAMPTZ,               -- 마지막 히트 시간
  expires_at TIMESTAMPTZ NOT NULL,       -- 만료 시간 (30일)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 검색 키워드 인덱스 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_medicine_cache_keyword ON medicine_cache(search_keyword);

-- 만료 시간 인덱스 (만료된 캐시 정리용)
CREATE INDEX IF NOT EXISTS idx_medicine_cache_expires ON medicine_cache(expires_at);

-- 출처별 인덱스
CREATE INDEX IF NOT EXISTS idx_medicine_cache_source ON medicine_cache(source);

-- RLS 정책 (모든 사용자 조회/수정 가능)
ALTER TABLE medicine_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read medicine_cache" ON medicine_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert medicine_cache" ON medicine_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update medicine_cache" ON medicine_cache
  FOR UPDATE USING (true);

-- 만료된 캐시 자동 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_expired_medicine_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM medicine_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 주석
COMMENT ON TABLE medicine_cache IS '의약품/건강기능식품 검색 결과 캐시 - API 호출 절약용';
COMMENT ON COLUMN medicine_cache.search_keyword IS '검색 키워드 (소문자 정규화된 값)';
COMMENT ON COLUMN medicine_cache.results IS 'API 검색 결과 JSON 배열';
COMMENT ON COLUMN medicine_cache.source IS '데이터 출처: e약은요, 의약품허가정보, 건강기능식품, AI생성';
COMMENT ON COLUMN medicine_cache.hit_count IS '캐시 히트 횟수 (효율성 측정용)';
