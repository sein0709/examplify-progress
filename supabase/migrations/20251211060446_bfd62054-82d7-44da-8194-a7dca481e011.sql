-- Add points_earned column for partial scoring on FRQ questions
ALTER TABLE public.student_answers 
ADD COLUMN points_earned numeric(3,2) CHECK (points_earned >= 0 AND points_earned <= 1);

-- Add comment for clarity
COMMENT ON COLUMN public.student_answers.points_earned IS 'Partial score for FRQ questions (0-1 scale, e.g., 0.5 for half credit)';