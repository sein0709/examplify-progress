-- Drop the unique constraint that prevents multiple submissions
-- This allows students to resubmit assignments when is_resubmittable = true
-- Application logic in Student.tsx already enforces max_attempts
ALTER TABLE public.submissions 
DROP CONSTRAINT IF EXISTS submissions_assignment_id_student_id_key;