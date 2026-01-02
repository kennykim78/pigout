-- =============================================
-- PIGOUT 피그라운지 (커뮤니티) 테이블 생성 스크립트
-- =============================================

-- 1. feed_posts 테이블 생성 (게시글)
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100), -- 작성 시점 닉네임 스냅샷 (조인 줄이기 위함)
  
  food_name VARCHAR(255) NOT NULL,
  score INTEGER,
  life_change INTEGER,
  comment TEXT,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_like_count ON feed_posts(like_count DESC);


-- 2. feed_comments 테이블 생성 (댓글)
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),
  
  content TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);


-- 3. feed_likes 테이블 생성 (좋아요)
CREATE TABLE IF NOT EXISTS feed_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id, user_id) -- 중복 좋아요 방지
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_feed_likes_post_id ON feed_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user_id ON feed_likes(user_id);


-- 4. feed_bookmarks 테이블 생성 (북마크/찜하기)
CREATE TABLE IF NOT EXISTS feed_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id, user_id) -- 중복 북마크 방지
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_feed_bookmarks_user_id ON feed_bookmarks(user_id);


-- 5. 트리거 함수: 좋아요/댓글 수 자동 업데이트
CREATE OR REPLACE FUNCTION update_feed_counts() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (TG_TABLE_NAME = 'feed_likes') THEN
      UPDATE feed_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF (TG_TABLE_NAME = 'feed_comments') THEN
      UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF (TG_TABLE_NAME = 'feed_likes') THEN
      UPDATE feed_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    ELSIF (TG_TABLE_NAME = 'feed_comments') THEN
      UPDATE feed_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 연결
DROP TRIGGER IF EXISTS trg_update_likes ON feed_likes;
CREATE TRIGGER trg_update_likes
AFTER INSERT OR DELETE ON feed_likes
FOR EACH ROW EXECUTE FUNCTION update_feed_counts();

DROP TRIGGER IF EXISTS trg_update_comments ON feed_comments;
CREATE TRIGGER trg_update_comments
AFTER INSERT OR DELETE ON feed_comments
FOR EACH ROW EXECUTE FUNCTION update_feed_counts();
