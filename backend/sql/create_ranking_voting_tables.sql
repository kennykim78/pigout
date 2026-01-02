-- 밸런스 게임 테이블 (주간 질문)
-- 실행 위치: Supabase SQL Editor

-- 1. balance_games 테이블 (주간 밸런스 게임 질문)
CREATE TABLE IF NOT EXISTS balance_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_key VARCHAR(10) NOT NULL UNIQUE, -- YYYY-WW 형식 (예: 2026-01)
  question TEXT NOT NULL,
  option_a_emoji VARCHAR(10) NOT NULL,
  option_a_label VARCHAR(50) NOT NULL,
  option_b_emoji VARCHAR(10) NOT NULL,
  option_b_label VARCHAR(50) NOT NULL,
  option_a_votes INTEGER DEFAULT 0,
  option_b_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 2. balance_votes 테이블 (사용자 투표 기록)
CREATE TABLE IF NOT EXISTS balance_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES balance_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('A', 'B')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id) -- 사용자당 1회 투표
);

-- 3. 음식 랭킹 캐시 테이블
CREATE TABLE IF NOT EXISTS food_ranking_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_date DATE NOT NULL UNIQUE,
  rankings JSONB NOT NULL, -- [{ rank, food_name, count }]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_balance_games_week_key ON balance_games(week_key);
CREATE INDEX IF NOT EXISTS idx_balance_votes_game_id ON balance_votes(game_id);
CREATE INDEX IF NOT EXISTS idx_balance_votes_user_id ON balance_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_food_ranking_cache_date ON food_ranking_cache(cache_date);

-- 5. 투표 시 카운트 자동 증가 함수
CREATE OR REPLACE FUNCTION update_balance_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.selected_option = 'A' THEN
    UPDATE balance_games 
    SET option_a_votes = option_a_votes + 1
    WHERE id = NEW.game_id;
  ELSE
    UPDATE balance_games 
    SET option_b_votes = option_b_votes + 1
    WHERE id = NEW.game_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_balance_vote ON balance_votes;
CREATE TRIGGER trigger_update_balance_vote
  AFTER INSERT ON balance_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_balance_vote_count();

-- 7. RLS 정책 설정
ALTER TABLE balance_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_ranking_cache ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 게임/캐시를 읽을 수 있음
CREATE POLICY "Anyone can read balance games" ON balance_games FOR SELECT USING (true);
CREATE POLICY "Anyone can read food ranking cache" ON food_ranking_cache FOR SELECT USING (true);

-- 인증된 사용자만 투표 가능
CREATE POLICY "Authenticated users can vote" ON balance_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read own votes" ON balance_votes FOR SELECT USING (true);
