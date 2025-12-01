-- food_analysis 테이블에 analysis_mode 컬럼 추가
-- Result01(quick)과 Result2(full) 구분용

ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS analysis_mode TEXT DEFAULT 'full';

-- 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_food_analysis_mode ON food_analysis(analysis_mode);

COMMENT ON COLUMN food_analysis.analysis_mode IS 'quick: Result01 빠른 분석, full: Result2 전체 분석';
