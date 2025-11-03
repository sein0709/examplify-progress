-- Update the assignments file_type check constraint to allow more file types
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_file_type_check;

-- Add the updated constraint with support for document and presentation types
ALTER TABLE public.assignments ADD CONSTRAINT assignments_file_type_check 
  CHECK (file_type IN ('image', 'pdf', 'document', 'presentation'));