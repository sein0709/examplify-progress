-- Allow instructors to read student roles so they can assign students to assignments
CREATE POLICY "Instructors can read student roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'instructor'::app_role) 
  AND role = 'student'::app_role
);