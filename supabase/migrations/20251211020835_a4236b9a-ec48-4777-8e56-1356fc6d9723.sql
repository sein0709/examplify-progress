-- Drop the old constraint that only allows 0-3
ALTER TABLE public.student_answers DROP CONSTRAINT student_answers_selected_answer_check;

-- Add new constraint that allows 0-4 (5 options)
ALTER TABLE public.student_answers ADD CONSTRAINT student_answers_selected_answer_check CHECK (selected_answer >= 0 AND selected_answer <= 4);