-- food_analysis 테이블에 diseases 컬럼 추가
-- 이미 테이블이 존재하는 경우 사용

-- diseases 컬럼 추가 (존재하지 않는 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'food_analysis' 
    AND column_name = 'diseases'
  ) THEN
    ALTER TABLE food_analysis ADD COLUMN diseases TEXT[] DEFAULT '{}';
    RAISE NOTICE 'diseases 컬럼이 추가되었습니다.';
  ELSE
    RAISE NOTICE 'diseases 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- 인덱스 추가 (diseases 배열 검색용)
CREATE INDEX IF NOT EXISTS idx_food_analysis_diseases ON food_analysis USING GIN(diseases);

RAISE NOTICE '완료! diseases 컬럼과 인덱스가 설정되었습니다.';
