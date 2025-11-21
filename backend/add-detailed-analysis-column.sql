-- Add detailed_analysis column to food_analysis table
-- This column stores detailed AI analysis results (pros, cons, cooking tips) as JSON

ALTER TABLE food_analysis 
ADD COLUMN IF NOT EXISTS detailed_analysis TEXT;

-- Add comment for documentation
COMMENT ON COLUMN food_analysis.detailed_analysis IS 'JSON string containing detailed AI analysis with pros, cons, summary, and cooking tips';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'food_analysis'
ORDER BY ordinal_position;
