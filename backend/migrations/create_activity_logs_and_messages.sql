-- =============================================
-- Activity Logs 테이블 (활동 기록 및 보너스 추적)
-- =============================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, 
  -- Types: 'food_analysis', 'detailed_view', 'medicine_analysis', 'recommendation_view'
  reference_id UUID,  -- food_record id 등 (optional)
  reference_name VARCHAR(255),  -- 음식명, 약명 등
  life_change_days DECIMAL(10,1) NOT NULL,  -- 수명 변화 일수
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(activity_type);

-- RLS 정책 (서버 사이드 접근 허용)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service" ON activity_logs
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Life Messages 테이블 (위트 문구)
-- =============================================

CREATE TABLE IF NOT EXISTS life_messages (
  id SERIAL PRIMARY KEY,
  min_life_expectancy INT NOT NULL,
  max_life_expectancy INT NOT NULL,
  message TEXT NOT NULL,
  emoji VARCHAR(10)
);

-- 기본 데이터 삽입
INSERT INTO life_messages (min_life_expectancy, max_life_expectancy, message, emoji) VALUES
(100, 999, '불로장생 달성! 신선님도 부러워하시겠네요', '🏆'),
(90, 99, '영생의 비밀을 알고 계신 건가요?', '✨'),
(85, 89, '건강 관리의 달인! 100세 시대 선두주자', '🌟'),
(80, 84, '평균 이상! 잘하고 계세요', '💪'),
(75, 79, '나쁘지 않아요. 조금만 더 신경쓰면 좋겠어요', '👍'),
(70, 74, '관리가 필요해요. 오늘부터 시작!', '⚠️'),
(65, 69, '주의! 생활습관 점검이 필요합니다', '⏰'),
(60, 64, '경고! 지금 바로 생활습관을 바꿔야 해요', '🚨'),
(0, 59, '위험! 전문가 상담을 권장합니다', '🆘')
ON CONFLICT DO NOTHING;

-- =============================================
-- 확인용 쿼리
-- =============================================
-- SELECT * FROM activity_logs LIMIT 10;
-- SELECT * FROM life_messages ORDER BY min_life_expectancy DESC;
