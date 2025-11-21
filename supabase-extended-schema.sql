-- ================================================================
-- 먹어도돼지? (PigOut) - Supabase Database Schema
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 약품 마스터 테이블 (medicine_list)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicine_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_code VARCHAR(50) UNIQUE,           -- 품목기준코드
  name VARCHAR(255) NOT NULL,                 -- 약품명
  manufacturer VARCHAR(255),                  -- 제조사
  ingredients TEXT[],                         -- 주성분 배열
  purpose TEXT,                               -- 효능/효과
  side_effects TEXT,                          -- 부작용
  precautions TEXT,                           -- 주의사항
  interactions TEXT[],                        -- 상호작용 약물
  food_interactions TEXT[],                   -- 음식 상호작용
  metadata JSONB,                             -- 기타 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medicine_list_code ON medicine_list(medicine_code);
CREATE INDEX idx_medicine_list_name ON medicine_list USING gin(to_tsvector('korean', name));

-- ----------------------------------------------------------------
-- 2. 사용자 복용 약 기록 테이블 (medicine_records)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicine_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicine_list(id) ON DELETE SET NULL,
  medicine_name VARCHAR(255) NOT NULL,        -- QR 스캔 또는 직접 입력
  dosage VARCHAR(100),                        -- 복용량
  frequency VARCHAR(100),                     -- 복용 빈도 (예: 하루 3회)
  start_date DATE,                            -- 복용 시작일
  end_date DATE,                              -- 복용 종료일 (NULL이면 진행중)
  qr_data TEXT,                               -- QR 스캔 원본 데이터
  is_active BOOLEAN DEFAULT true,             -- 현재 복용 여부
  notes TEXT,                                 -- 메모
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medicine_records_user ON medicine_records(user_id);
CREATE INDEX idx_medicine_records_active ON medicine_records(user_id, is_active);

-- RLS 정책
ALTER TABLE medicine_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own medicine records"
  ON medicine_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medicine records"
  ON medicine_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medicine records"
  ON medicine_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medicine records"
  ON medicine_records FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 3. 종합 분석 결과 테이블 (combined_records)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS combined_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_record_id UUID REFERENCES food_records(id) ON DELETE SET NULL,
  
  -- 분석 대상
  food_name VARCHAR(255) NOT NULL,
  image_path TEXT,
  medicines TEXT[],                           -- 분석에 포함된 약물 목록
  supplements TEXT[],                         -- 영양제 목록
  diseases TEXT[],                            -- 기저질환
  
  -- Flash 분석 결과 (빠른 평가)
  flash_score INTEGER CHECK (flash_score BETWEEN 0 AND 100),
  flash_grade CHAR(1),                        -- A, B, C, D, F
  flash_risks TEXT[],                         -- 주요 위험 요소
  
  -- Pro 분석 결과 (상세 평가)
  pro_detailed_reason TEXT,
  pro_interactions JSONB,                     -- 약물 상호작용 상세
  pro_nutrition_guidance TEXT,
  pro_recommendations TEXT[],
  pro_global_remedies JSONB,
  
  -- 종합 평가
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  overall_grade CHAR(1),
  recommendation_level VARCHAR(20),           -- safe, caution, avoid, danger
  
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_combined_records_user ON combined_records(user_id);
CREATE INDEX idx_combined_records_date ON combined_records(user_id, analyzed_at DESC);
CREATE INDEX idx_combined_records_food ON combined_records(food_record_id);

-- RLS 정책
ALTER TABLE combined_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own combined records"
  ON combined_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own combined records"
  ON combined_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 4. 교환 가능 상품 테이블 (rewards)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL,                -- GiftShow, CU, Starbucks 등
  point_cost INTEGER NOT NULL CHECK (point_cost > 0),
  description TEXT,
  image_url TEXT,
  category VARCHAR(50),                       -- gift_card, coupon, discount
  is_available BOOLEAN DEFAULT true,
  stock_quantity INTEGER,                     -- NULL이면 무제한
  valid_until DATE,                           -- 교환 가능 기한
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rewards_available ON rewards(is_available, point_cost);
CREATE INDEX idx_rewards_brand ON rewards(brand);

-- ----------------------------------------------------------------
-- 5. 포인트 적립/사용 내역 테이블 (reward_history)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'spend', 'expire')),
  points INTEGER NOT NULL,                    -- 양수: 적립, 음수: 사용
  
  -- 적립 관련
  reason VARCHAR(100),                        -- daily_70, daily_85, bonus 등
  reference_date DATE,                        -- 적립 기준일
  
  -- 사용 관련
  reward_id UUID REFERENCES rewards(id) ON DELETE SET NULL,
  reward_name VARCHAR(255),
  
  balance_after INTEGER NOT NULL,             -- 거래 후 잔액
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reward_history_user ON reward_history(user_id, created_at DESC);
CREATE INDEX idx_reward_history_type ON reward_history(user_id, type);

-- RLS 정책
ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reward history"
  ON reward_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert reward history"
  ON reward_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 6. 일별 점수 집계 테이블 (daily_scores)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- 음식 분석 집계
  food_count INTEGER DEFAULT 0,
  food_avg_score DECIMAL(5,2),
  food_total_score INTEGER DEFAULT 0,
  
  -- 약물 분석 집계
  medicine_count INTEGER DEFAULT 0,
  medicine_avg_score DECIMAL(5,2),
  medicine_total_score INTEGER DEFAULT 0,
  
  -- 종합 집계
  combined_count INTEGER DEFAULT 0,
  combined_avg_score DECIMAL(5,2),
  
  -- 포인트 획득
  points_earned INTEGER DEFAULT 0,
  point_rule_applied VARCHAR(20),             -- daily_70, daily_85
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_scores_user_date ON daily_scores(user_id, date DESC);

-- RLS 정책
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily scores"
  ON daily_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage daily scores"
  ON daily_scores FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. 월별 통계 테이블 (monthly_scores)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  
  -- 일별 점수 통계
  total_days INTEGER DEFAULT 0,
  avg_score DECIMAL(5,2),
  best_score INTEGER,
  worst_score INTEGER,
  
  -- 기록 통계
  total_food_records INTEGER DEFAULT 0,
  total_medicine_records INTEGER DEFAULT 0,
  total_combined_records INTEGER DEFAULT 0,
  
  -- 포인트 통계
  total_points_earned INTEGER DEFAULT 0,
  days_above_70 INTEGER DEFAULT 0,
  days_above_85 INTEGER DEFAULT 0,
  
  -- 연속 기록 통계
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, year, month)
);

CREATE INDEX idx_monthly_scores_user ON monthly_scores(user_id, year DESC, month DESC);

-- RLS 정책
ALTER TABLE monthly_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly scores"
  ON monthly_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage monthly scores"
  ON monthly_scores FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 8. 사용자 프로필 확장 (user_profiles)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50),
  full_name VARCHAR(100),
  avatar_url TEXT,
  
  -- 건강 정보
  birth_date DATE,
  gender VARCHAR(10),
  diseases TEXT[],                            -- 기저질환 목록
  
  -- 포인트 잔액
  current_points INTEGER DEFAULT 0,
  lifetime_points_earned INTEGER DEFAULT 0,
  lifetime_points_spent INTEGER DEFAULT 0,
  
  -- 설정
  notification_enabled BOOLEAN DEFAULT true,
  language VARCHAR(10) DEFAULT 'ko',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ----------------------------------------------------------------
-- 9. 트리거 함수 (자동 업데이트)
-- ----------------------------------------------------------------

-- 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER update_medicine_list_updated_at
  BEFORE UPDATE ON medicine_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicine_records_updated_at
  BEFORE UPDATE ON medicine_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_scores_updated_at
  BEFORE UPDATE ON daily_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_scores_updated_at
  BEFORE UPDATE ON monthly_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- 10. 샘플 데이터 삽입
-- ----------------------------------------------------------------

-- 교환 가능 상품 샘플
INSERT INTO rewards (name, brand, point_cost, description, image_url, category) VALUES
('스타벅스 아메리카노 Tall', 'Starbucks', 50, '스타벅스 아메리카노 Tall 사이즈 1잔', 'https://placehold.co/200x200/png?text=Starbucks', 'gift_card'),
('CU 편의점 5000원 상품권', 'CU', 100, 'CU 편의점에서 사용 가능한 5000원 상품권', 'https://placehold.co/200x200/png?text=CU', 'gift_card'),
('GiftShow 만원권', 'GiftShow', 200, '온라인/오프라인 사용 가능한 기프트쇼 만원권', 'https://placehold.co/200x200/png?text=GiftShow', 'gift_card'),
('베스킨라빈스 파인트', 'Baskin Robbins', 80, '베스킨라빈스 파인트 아이스크림 1개', 'https://placehold.co/200x200/png?text=BR', 'coupon'),
('올리브영 1만원 할인쿠폰', 'Olive Young', 150, '올리브영 온라인/오프라인 매장 1만원 할인', 'https://placehold.co/200x200/png?text=OliveYoung', 'discount');

-- 약품 마스터 샘플 데이터
INSERT INTO medicine_list (medicine_code, name, manufacturer, ingredients, purpose, side_effects, precautions, interactions, food_interactions) VALUES
('8806429021102', '타이레놀 500mg', 'Johnson & Johnson', ARRAY['아세트아미노펜 500mg'], '해열, 진통', '드물게 간 손상, 알레르기 반응', '과량 복용 시 간 손상 위험, 음주 시 복용 금지', ARRAY['와파린'], ARRAY['알코올']),
('8806534010104', '아스피린 100mg', 'Bayer', ARRAY['아세틸살리실산 100mg'], '심혈관 질환 예방, 진통', '위장 장애, 출혈 경향', '위궤양 환자 주의, 임산부 금기', ARRAY['와파린', '클로피도그렐'], ARRAY['알코올', '카페인']),
('8806475032701', '메트포르민 500mg', 'Yuhan', ARRAY['메트포르민염산염 500mg'], '2형 당뇨병 치료', '오심, 설사, 복부 불편감', '신장 기능 저하 시 주의', ARRAY['인슐린'], ARRAY['알코올', '고당도 음식']),
('8806520013408', '아모디핀 5mg', 'Pfizer', ARRAY['암로디핀베실산염 5mg'], '고혈압, 협심증 치료', '부종, 두통, 어지러움', '저혈압 주의', ARRAY['심바스타틴'], ARRAY['자몽', '알코올']);

-- ================================================================
-- 완료
-- ================================================================
COMMIT;
