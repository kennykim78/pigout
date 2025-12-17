-- ========================================
-- food_rules 테이블에 warnings, cooking_tips 추가
-- Phase 2.5: food_rules 데이터 보완
-- ========================================

-- 1단계: 컬럼 추가
ALTER TABLE food_rules 
  ADD COLUMN IF NOT EXISTS warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS cooking_tips TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 컬럼 설명 추가
COMMENT ON COLUMN food_rules.warnings IS '특별 경고 사항 (질병/알레르기 관련 중요 주의사항)';
COMMENT ON COLUMN food_rules.cooking_tips IS '건강한 조리법/섭취 팁 (영양소 보존, 위험 요소 제거 방법)';

-- 2단계: 기존 데이터에 기본값 설정 (선택)
-- 참고: 기존 100개 음식 데이터에 warnings, cooking_tips를 채우려면
-- AI 분석을 통해 일괄 업데이트하거나, 수동으로 채워야 함
-- 
-- 예시 업데이트:
-- UPDATE food_rules 
-- SET 
--   warnings = ARRAY['고나트륨 - 신장질환 환자 주의', '매운맛 - 위염/역류성식도염 환자 주의'],
--   cooking_tips = ARRAY['국물을 먼저 끓여 기름기 제거', '김치는 익은 것 사용하면 소화 부담 감소', '두부를 추가하면 단백질 보충']
-- WHERE food_name = '김치찌개';

-- 3단계: 인덱스 추가 (warnings 검색용, 선택)
-- CREATE INDEX IF NOT EXISTS idx_food_rules_warnings ON food_rules USING GIN(warnings);

-- 완료
SELECT 
  'food_rules 테이블 확장 완료' AS status,
  COUNT(*) AS total_foods,
  COUNT(CASE WHEN array_length(warnings, 1) > 0 THEN 1 END) AS foods_with_warnings,
  COUNT(CASE WHEN array_length(cooking_tips, 1) > 0 THEN 1 END) AS foods_with_tips
FROM food_rules;
