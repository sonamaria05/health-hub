-- Task 5: clinician dashboard needs to show patient names, which requires
-- reading other users' profiles - a policy that didn't exist yet (only
-- "view own profile" did). Without this, clinicians could see all
-- medical_records rows but had no way to resolve display names for them.

DROP POLICY IF EXISTS "Clinicians and admins can view all profiles" ON public.profiles;
CREATE POLICY "Clinicians and admins can view all profiles" ON public.profiles FOR SELECT
  USING (public.is_clinician_or_admin(auth.uid()));
