-- Add question type enum
CREATE TYPE question_type AS ENUM ('multiple_choice', 'free_response');

-- Add columns to questions table
ALTER TABLE questions 
  ADD COLUMN question_type question_type NOT NULL DEFAULT 'multiple_choice',
  ADD COLUMN model_answer TEXT NULL;

-- Make correct_answer nullable (not required for free response)
ALTER TABLE questions 
  ALTER COLUMN correct_answer DROP NOT NULL;

-- Add columns to student_answers table for free response and grading
ALTER TABLE student_answers 
  ADD COLUMN text_answer TEXT NULL,
  ADD COLUMN is_correct BOOLEAN NULL,
  ADD COLUMN graded_by UUID NULL,
  ADD COLUMN graded_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN feedback TEXT NULL;

-- Make selected_answer nullable (not required for free response)
ALTER TABLE student_answers 
  ALTER COLUMN selected_answer DROP NOT NULL;

-- Add constraint: must have either selected_answer OR text_answer
ALTER TABLE student_answers ADD CONSTRAINT answer_type_check 
  CHECK (selected_answer IS NOT NULL OR text_answer IS NOT NULL);