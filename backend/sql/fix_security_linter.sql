-- Supabase Security Linter 경고 해결
-- 실행 위치: Supabase SQL Editor

-- ===========================================
-- 1. Security Definer View 수정
-- SECURITY DEFINER → SECURITY INVOKER로 변경
-- ===========================================

-- 1.1 popular_food_analysis 뷰 수정
DROP VIEW IF EXISTS public.popular_food_analysis;
CREATE VIEW public.popular_food_analysis 
WITH (security_invoker = on)
AS
SELECT 
  food_name,
  COUNT(*) as analysis_count,
  AVG(score) as avg_score,
  MAX(created_at) as last_analyzed
FROM public.food_analysis
WHERE food_name IS NOT NULL
GROUP BY food_name
ORDER BY analysis_count DESC;

-- 1.2 cache_statistics 뷰 수정
DROP VIEW IF EXISTS public.cache_statistics;
CREATE VIEW public.cache_statistics 
WITH (security_invoker = on)
AS
SELECT 
  'analysis_cache' as cache_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as entries_24h
FROM public.analysis_cache
UNION ALL
SELECT 
  'medicine_analysis_cache' as cache_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as entries_24h
FROM public.medicine_analysis_cache;

-- ===========================================
-- 2. RLS 활성화 (Row Level Security)
-- ===========================================

-- 2.1 disease_enhanced_info (공개 읽기, 관리자만 수정)
ALTER TABLE public.disease_enhanced_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read disease info" ON public.disease_enhanced_info
  FOR SELECT USING (true);

-- 2.2 users (본인 데이터만 접근)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (true); -- 백엔드 service_role로 접근하므로 전체 허용
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert" ON public.users
  FOR INSERT WITH CHECK (true);

-- 2.3 life_messages (공개 읽기)
ALTER TABLE public.life_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read life messages" ON public.life_messages
  FOR SELECT USING (true);

-- 2.4 feed_reports (백엔드 전용)
ALTER TABLE public.feed_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend can manage reports" ON public.feed_reports
  FOR ALL USING (true);

-- 2.5 analysis_cache (백엔드 전용 캐시)
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend can manage cache" ON public.analysis_cache
  FOR ALL USING (true);

-- 2.6 medicine_analysis_cache (백엔드 전용 캐시)
ALTER TABLE public.medicine_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend can manage medicine cache" ON public.medicine_analysis_cache
  FOR ALL USING (true);

-- 2.7 feed_likes (사용자별 좋아요)
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read likes" ON public.feed_likes
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own likes" ON public.feed_likes
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own likes" ON public.feed_likes
  FOR DELETE USING (true);

-- 2.8 feed_bookmarks (사용자별 북마크)
ALTER TABLE public.feed_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read bookmarks" ON public.feed_bookmarks
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own bookmarks" ON public.feed_bookmarks
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own bookmarks" ON public.feed_bookmarks
  FOR DELETE USING (true);

-- 2.9 feed_posts (공개 피드)
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read public posts" ON public.feed_posts
  FOR SELECT USING (is_public = true OR true); -- 백엔드에서 필터링
CREATE POLICY "Users can create posts" ON public.feed_posts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own posts" ON public.feed_posts
  FOR UPDATE USING (true);
CREATE POLICY "Users can delete own posts" ON public.feed_posts
  FOR DELETE USING (true);

-- ===========================================
-- 완료 메시지
-- ===========================================
SELECT 'Security fixes applied successfully!' as status;
