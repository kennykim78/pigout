-- Fix daily_recommendations foreign key constraint
-- The table references auth.users, but we use public.users table

-- Step 1: Drop existing foreign key constraint
ALTER TABLE daily_recommendations 
DROP CONSTRAINT IF EXISTS daily_recommendations_user_id_fkey;

-- Step 2: Add new foreign key referencing public.users
ALTER TABLE daily_recommendations
ADD CONSTRAINT daily_recommendations_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Verify the change
-- SELECT conname, conrelid::regclass, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE conrelid = 'daily_recommendations'::regclass;
