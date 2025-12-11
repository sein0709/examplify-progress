-- Add assignment_type column to assignments table
ALTER TABLE assignments ADD COLUMN assignment_type text NOT NULL DEFAULT 'quiz';

-- Create assignment_completions table for reading assignments
CREATE TABLE public.assignment_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

-- Enable RLS
ALTER TABLE public.assignment_completions ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignment_completions
CREATE POLICY "Admins can do everything on assignment_completions"
ON public.assignment_completions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can read completions for their assignments"
ON public.assignment_completions
FOR SELECT
USING (
  has_role(auth.uid(), 'instructor') AND 
  EXISTS (
    SELECT 1 FROM assignments 
    WHERE assignments.id = assignment_completions.assignment_id 
    AND assignments.instructor_id = auth.uid()
  )
);

CREATE POLICY "Students can read own completions"
ON public.assignment_completions
FOR SELECT
USING (has_role(auth.uid(), 'student') AND auth.uid() = student_id);

CREATE POLICY "Students can insert own completions"
ON public.assignment_completions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'student') AND auth.uid() = student_id);

CREATE POLICY "Students can delete own completions"
ON public.assignment_completions
FOR DELETE
USING (has_role(auth.uid(), 'student') AND auth.uid() = student_id);