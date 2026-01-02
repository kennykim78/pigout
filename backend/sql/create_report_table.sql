-- =============================================
-- PIGOUT 피그라운지 신고 테이블 생성 스크립트
-- =============================================

CREATE TABLE IF NOT EXISTS feed_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- 신고자
  reason TEXT NOT NULL,          -- 신고 사유
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, REVIEWED, HIDDEN
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_reports_post_id ON feed_reports(post_id);
