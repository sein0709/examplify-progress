-- Drop the existing constraint that only allows 0-3
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_correct_answer_check;

-- Add new constraint that allows 0-4 (for 5 options)
ALTER TABLE questions ADD CONSTRAINT questions_correct_answer_check 
  CHECK (correct_answer >= 0 AND correct_answer <= 4);