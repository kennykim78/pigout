-- 피그라운지 알림 테이블
-- 실행 위치: Supabase SQL Editor

-- 1. notifications 테이블 생성
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 알림 받는 사람
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL, -- 알림 보낸 사람 (nullable)
  actor_nickname VARCHAR(100), -- 액터 닉네임 캐시
  type VARCHAR(20) NOT NULL CHECK (type IN ('like', 'comment', 'bookmark', 'system')),
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE, -- 관련 게시물
  message TEXT NOT NULL, -- 알림 메시지
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- 3. RLS 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 알림을 읽을 수 있음 (백엔드에서 user_id 필터링)
CREATE POLICY "Backend can manage notifications" ON notifications
  FOR ALL USING (true);

-- 4. 좋아요 시 알림 자동 생성 트리거
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  post_preview TEXT;
  actor_name VARCHAR(100);
BEGIN
  -- 게시물 작성자 ID 조회
  SELECT user_id, LEFT(comment, 30) INTO post_owner_id, post_preview
  FROM feed_posts WHERE id = NEW.post_id;
  
  -- 본인 글에 좋아요는 알림 안함
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- 액터 닉네임 조회
  SELECT nickname INTO actor_name FROM users WHERE id = NEW.user_id;
  actor_name := COALESCE(actor_name, '익명 돼지');
  
  -- 알림 생성
  INSERT INTO notifications (user_id, actor_id, actor_nickname, type, post_id, message)
  VALUES (
    post_owner_id,
    NEW.user_id,
    actor_name,
    'like',
    NEW.post_id,
    actor_name || '님이 회원님의 글에 좋아요를 눌렀어요! ❤️'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_like ON feed_likes;
CREATE TRIGGER trigger_notify_on_like
  AFTER INSERT ON feed_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_like();

-- 5. 댓글 시 알림 자동 생성 트리거
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  actor_name VARCHAR(100);
  comment_preview TEXT;
BEGIN
  -- 게시물 작성자 ID 조회
  SELECT user_id INTO post_owner_id
  FROM feed_posts WHERE id = NEW.post_id;
  
  -- 본인 글에 댓글은 알림 안함
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- 액터 닉네임 조회
  SELECT nickname INTO actor_name FROM users WHERE id = NEW.user_id;
  actor_name := COALESCE(actor_name, '익명 돼지');
  
  -- 댓글 미리보기 (최대 20자)
  comment_preview := LEFT(NEW.content, 20);
  IF LENGTH(NEW.content) > 20 THEN
    comment_preview := comment_preview || '...';
  END IF;
  
  -- 알림 생성
  INSERT INTO notifications (user_id, actor_id, actor_nickname, type, post_id, message)
  VALUES (
    post_owner_id,
    NEW.user_id,
    actor_name,
    'comment',
    NEW.post_id,
    actor_name || '님이 댓글을 남겼어요: "' || comment_preview || '" 💬'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_comment ON feed_comments;
CREATE TRIGGER trigger_notify_on_comment
  AFTER INSERT ON feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_comment();

-- 6. 북마크 시 알림 자동 생성 트리거
CREATE OR REPLACE FUNCTION notify_on_bookmark()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  actor_name VARCHAR(100);
BEGIN
  -- 게시물 작성자 ID 조회
  SELECT user_id INTO post_owner_id
  FROM feed_posts WHERE id = NEW.post_id;
  
  -- 본인 글 북마크는 알림 안함
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- 액터 닉네임 조회
  SELECT nickname INTO actor_name FROM users WHERE id = NEW.user_id;
  actor_name := COALESCE(actor_name, '익명 돼지');
  
  -- 알림 생성
  INSERT INTO notifications (user_id, actor_id, actor_nickname, type, post_id, message)
  VALUES (
    post_owner_id,
    NEW.user_id,
    actor_name,
    'bookmark',
    NEW.post_id,
    actor_name || '님이 회원님의 글을 저장했어요! ⭐'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_bookmark ON feed_bookmarks;
CREATE TRIGGER trigger_notify_on_bookmark
  AFTER INSERT ON feed_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_bookmark();

-- 완료 메시지
SELECT 'Notifications table and triggers created successfully!' as status;
