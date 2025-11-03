-- Add email to profiles table for easier access
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
  order_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  score INTEGER,
  total_questions INTEGER NOT NULL,
  UNIQUE(assignment_id, student_id)
);

-- Create student_answers table
CREATE TABLE IF NOT EXISTS public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer INTEGER NOT NULL CHECK (selected_answer >= 0 AND selected_answer <= 3),
  UNIQUE(submission_id, question_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments table
CREATE POLICY "Admins can do everything on assignments"
  ON public.assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can create assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'instructor'::app_role) AND auth.uid() = instructor_id);

CREATE POLICY "Instructors can read own assignments"
  ON public.assignments FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role) AND auth.uid() = instructor_id);

CREATE POLICY "Instructors can update own assignments"
  ON public.assignments FOR UPDATE
  USING (has_role(auth.uid(), 'instructor'::app_role) AND auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete own assignments"
  ON public.assignments FOR DELETE
  USING (has_role(auth.uid(), 'instructor'::app_role) AND auth.uid() = instructor_id);

CREATE POLICY "Students can read all assignments"
  ON public.assignments FOR SELECT
  USING (has_role(auth.uid(), 'student'::app_role));

-- RLS Policies for questions table
CREATE POLICY "Admins can do everything on questions"
  ON public.questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can manage own assignment questions"
  ON public.questions FOR ALL
  USING (
    has_role(auth.uid(), 'instructor'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.assignments 
      WHERE assignments.id = questions.assignment_id 
      AND assignments.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Students can read questions for assignments"
  ON public.questions FOR SELECT
  USING (has_role(auth.uid(), 'student'::app_role));

-- RLS Policies for submissions table
CREATE POLICY "Admins can do everything on submissions"
  ON public.submissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can read submissions for their assignments"
  ON public.submissions FOR SELECT
  USING (
    has_role(auth.uid(), 'instructor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.assignments
      WHERE assignments.id = submissions.assignment_id
      AND assignments.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Students can create own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'student'::app_role) AND auth.uid() = student_id);

CREATE POLICY "Students can read own submissions"
  ON public.submissions FOR SELECT
  USING (has_role(auth.uid(), 'student'::app_role) AND auth.uid() = student_id);

-- RLS Policies for student_answers table
CREATE POLICY "Admins can do everything on student_answers"
  ON public.student_answers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can read answers for their assignments"
  ON public.student_answers FOR SELECT
  USING (
    has_role(auth.uid(), 'instructor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.submissions
      JOIN public.assignments ON assignments.id = submissions.assignment_id
      WHERE submissions.id = student_answers.submission_id
      AND assignments.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Students can create own answers"
  ON public.student_answers FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'student'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = student_answers.submission_id
      AND submissions.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can read own answers"
  ON public.student_answers FOR SELECT
  USING (
    has_role(auth.uid(), 'student'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = student_answers.submission_id
      AND submissions.student_id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    FALSE
  );
  RETURN NEW;
END;
$$;