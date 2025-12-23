-- 추천 글로벌 캐시 테이블
-- 동일 조건(나이대, 성별, 질병) 사용자는 AI 호출 없이 캐시 반환

CREATE TABLE IF NOT EXISTS recommendation_global_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,  -- "30대_남성_고혈압,당뇨"
  age_group TEXT NOT NULL,          -- "30대", "40대" 등
  gender TEXT NOT NULL,             -- "남성", "여성"
  diseases TEXT[] DEFAULT '{}',     -- 질병 목록 (정렬됨)
  food_content JSONB,               -- 음식 추천
  remedy_content JSONB,             -- 민간요법
  exercise_content JSONB,           -- 운동 추천
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  hit_count INTEGER DEFAULT 0       -- 캐시 히트 횟수 (통계용)
);

-- 캐시 키 인덱스
CREATE INDEX IF NOT EXISTS idx_rec_cache_key ON recommendation_global_cache(cache_key);

-- 만료일 인덱스 (정리용)
CREATE INDEX IF NOT EXISTS idx_rec_cache_expires ON recommendation_global_cache(expires_at);

-- RLS 정책 (모든 사용자가 읽기 가능, 서비스만 쓰기)
ALTER TABLE recommendation_global_cache ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 모든 인증된 사용자
CREATE POLICY "recommendation_global_cache_read" ON recommendation_global_cache
  FOR SELECT USING (true);

-- 쓰기 정책: 서비스 역할만
CREATE POLICY "recommendation_global_cache_write" ON recommendation_global_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "recommendation_global_cache_update" ON recommendation_global_cache
  FOR UPDATE USING (true);

COMMENT ON TABLE recommendation_global_cache IS '추천 글로벌 캐시 - 동일 조건 사용자는 AI 호출 없이 반환';
