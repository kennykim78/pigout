-- 피그라운지 댓글 테이블 생성
-- 실행 위치: Supabase SQL Editor

-- 1. feed_comments 테이블 생성
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user_id ON feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created_at ON feed_comments(created_at);

-- 3. feed_posts 테이블에 comment_count 및 post_type 컬럼 추가
ALTER TABLE feed_posts 
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

ALTER TABLE feed_posts 
ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) DEFAULT 'food';

-- 4. food_name을 nullable로 변경 (일반 피드 지원)
ALTER TABLE feed_posts 
ALTER COLUMN food_name DROP NOT NULL;

-- 5. 댓글 수 증가 RPC 함수
CREATE OR REPLACE FUNCTION increment_comment_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE feed_posts 
  SET comment_count = COALESCE(comment_count, 0) + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- 6. 댓글 수 감소 RPC 함수
CREATE OR REPLACE FUNCTION decrement_comment_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE feed_posts 
  SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS 정책 설정 (Row Level Security)
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 댓글을 읽을 수 있음
CREATE POLICY "Anyone can read comments" ON feed_comments
  FOR SELECT USING (true);

-- 인증된 사용자만 댓글 작성 가능
CREATE POLICY "Authenticated users can create comments" ON feed_comments
  FOR INSERT WITH CHECK (true);

-- 본인 댓글만 삭제 가능
CREATE POLICY "Users can delete own comments" ON feed_comments
  FOR DELETE USING (auth.uid() = user_id);

-- 8. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feed_comments_updated_at
  BEFORE UPDATE ON feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
