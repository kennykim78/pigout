-- Phase 2: 연령대 기반 음식 분석 캐시 최적화
-- 생성일: 2025-12-17

-- ============================================
-- 1. food_analysis 테이블 확장
-- ============================================

-- age_group 컬럼 추가 (10세 단위)
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS age_group TEXT;

-- gender 컬럼 추가
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS gender TEXT;

-- is_from_food_rules 플래그 추가 (사전 등록 DB 여부)
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS is_from_food_rules BOOLEAN DEFAULT false;

-- detailed_analysis_json 컬럼 추가 (상세 분석 결과 저장)
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS detailed_analysis_json JSONB;

-- data_sources 컬럼 추가 (데이터 출처)
ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS data_sources TEXT[];

-- ============================================
-- 2. 인덱스 추가 (캐시 조회 최적화)
-- ============================================

-- 연령대 + 성별 기반 캐시 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_food_analysis_cache_lookup 
ON food_analysis(food_name, age_group, gender) 
WHERE age_group IS NOT NULL;

-- food_rules 기반 분석 필터링 인덱스
CREATE INDEX IF NOT EXISTS idx_food_analysis_from_rules 
ON food_analysis(food_name, is_from_food_rules) 
WHERE is_from_food_rules = true;

-- ============================================
-- 3. 주석 추가
-- ============================================

COMMENT ON COLUMN food_analysis.age_group IS '연령대 그룹 (10대, 20대, 30대, ..., 70대+)';
COMMENT ON COLUMN food_analysis.gender IS '성별 (male, female)';
COMMENT ON COLUMN food_analysis.is_from_food_rules IS 'food_rules 테이블 기반 분석 여부 (토큰 절약)';
COMMENT ON COLUMN food_analysis.detailed_analysis_json IS '상세 분석 결과 (JSON)';
COMMENT ON COLUMN food_analysis.data_sources IS '데이터 출처 배열 (식약처, Gemini AI 등)';

-- ============================================
-- 4. 기존 데이터 마이그레이션 (선택)
-- ============================================

-- 기존 레코드의 age_group 계산 (users 테이블과 조인 필요시)
-- UPDATE food_analysis fa
-- SET age_group = CASE 
--   WHEN u.age < 20 THEN '10대'
--   WHEN u.age < 30 THEN '20대'
--   WHEN u.age < 40 THEN '30대'
--   WHEN u.age < 50 THEN '40대'
--   WHEN u.age < 60 THEN '50대'
--   WHEN u.age < 70 THEN '60대'
--   ELSE '70대+'
-- END,
-- gender = u.gender
-- FROM users u
-- WHERE fa.user_id = u.id AND fa.age_group IS NULL;
