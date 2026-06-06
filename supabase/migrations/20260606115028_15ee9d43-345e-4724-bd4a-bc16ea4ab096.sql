
-- 1. Profile reads → own only
DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
CREATE POLICY profiles_read_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 2. Storage UPDATE policy on datasets bucket
DROP POLICY IF EXISTS "datasets_update_own_objects" ON storage.objects;
CREATE POLICY "datasets_update_own_objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'datasets' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'datasets' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. Move pg_net out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
