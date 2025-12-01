-- ========================================
-- 계층적 음식 규칙 테이블 (Supabase)
-- ========================================

-- food_rules 테이블 생성
CREATE TABLE IF NOT EXISTS food_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  food_name TEXT NOT NULL UNIQUE, -- 음식명 (키)
  base_score INTEGER NOT NULL CHECK (base_score >= 0 AND base_score <= 100), -- 기본 점수
  summary TEXT NOT NULL, -- 요약
  pros TEXT NOT NULL, -- 장점
  cons TEXT NOT NULL, -- 단점
  expert_advice TEXT NOT NULL, -- 전문가 조언
  nutrients JSONB NOT NULL, -- 영양 정보 (JSON)
  disease_analysis JSONB NOT NULL, -- 질병별 분석 (JSON)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 음식명 인덱스 (빠른 검색)
CREATE INDEX IF NOT EXISTS idx_food_rules_food_name ON food_rules(food_name);

-- 업데이트 시각 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_food_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_food_rules_updated_at
BEFORE UPDATE ON food_rules
FOR EACH ROW
EXECUTE FUNCTION update_food_rules_updated_at();

-- ========================================
-- 예시 데이터 구조 (참고용)
-- ========================================
-- INSERT INTO food_rules (food_name, base_score, summary, pros, cons, expert_advice, nutrients, disease_analysis)
-- VALUES (
--   '물',
--   95,
--   '물은 인체의 60-70%를 구성하는 필수 성분으로...',
--   '수분 보충, 신진대사 촉진...',
--   '과도한 섭취 시 저나트륨혈증 가능...',
--   '하루 8잔(약 2L)을 식사 사이사이에...',
--   '{"calories": "0kcal/100g", "protein": "0g", "carbs": "0g", ...}'::jsonb,
--   '{"당뇨": {"scoreModifier": 5, "risk": "safe", "reason": "혈당에 영향 없음"}, ...}'::jsonb
-- );

-- ========================================
-- RLS (Row Level Security) 설정
-- ========================================
-- 모든 사용자가 읽기 가능, 관리자만 쓰기 가능
ALTER TABLE food_rules ENABLE ROW LEVEL SECURITY;

-- 읽기 권한: 모두 허용
CREATE POLICY "Allow public read access to food_rules"
ON food_rules FOR SELECT
TO public
USING (true);

-- 쓰기 권한: 인증된 사용자만 (서비스 키 사용 시 관리자)
CREATE POLICY "Allow authenticated insert to food_rules"
ON food_rules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update to food_rules"
ON food_rules FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete to food_rules"
ON food_rules FOR DELETE
TO authenticated
USING (true);
