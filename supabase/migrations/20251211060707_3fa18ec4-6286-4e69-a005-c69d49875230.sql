-- Update submissions.score to support decimal values for partial scoring
ALTER TABLE public.submissions 
ALTER COLUMN score TYPE numeric(6,2);