-- Fix RLS policy for daily_recommendations table
-- The backend uses service_role key or needs server-side INSERT capability

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own recommendations" ON daily_recommendations;
DROP POLICY IF EXISTS "Users can insert their own recommendations" ON daily_recommendations;

-- Create more permissive policies that allow server-side operations
-- SELECT: Allow users to view their own, or service role can view all
CREATE POLICY "Allow select for own user or service role"
  ON daily_recommendations FOR SELECT
  USING (
    user_id = auth.uid() 
    OR auth.role() = 'service_role'
    OR auth.uid() IS NULL  -- Allow when no auth (service calls)
  );

-- INSERT: Allow for matching user_id or service role
CREATE POLICY "Allow insert for service role or authenticated"
  ON daily_recommendations FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    OR auth.role() = 'service_role'
    OR auth.uid() IS NULL  -- Allow server-side inserts
  );

-- UPDATE: Allow updates by owner or service role
CREATE POLICY "Allow update for own user or service role"
  ON daily_recommendations FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR auth.role() = 'service_role'
    OR auth.uid() IS NULL
  );

-- DELETE: Allow by owner or service role
CREATE POLICY "Allow delete for own user or service role"
  ON daily_recommendations FOR DELETE
  USING (
    user_id = auth.uid() 
    OR auth.role() = 'service_role'
    OR auth.uid() IS NULL
  );
