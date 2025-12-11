-- Drop and recreate the get_assignment_questions function with new return type
DROP FUNCTION IF EXISTS public.get_assignment_questions(uuid, boolean);

CREATE FUNCTION public.get_assignment_questions(_assignment_id uuid, _include_answers boolean DEFAULT false)
 RETURNS TABLE(id uuid, assignment_id uuid, text text, options jsonb, correct_answer integer, explanation text, order_number integer, created_at timestamp with time zone, question_type question_type, model_answer text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user should see answers (instructors, admins, or if explicitly requested after submission)
  IF _include_answers OR 
     has_role(auth.uid(), 'instructor') OR 
     has_role(auth.uid(), 'admin') THEN
    -- Return all fields including correct_answer and model_answer
    RETURN QUERY
    SELECT 
      q.id,
      q.assignment_id,
      q.text,
      q.options,
      q.correct_answer,
      q.explanation,
      q.order_number,
      q.created_at,
      q.question_type,
      q.model_answer
    FROM questions q
    WHERE q.assignment_id = _assignment_id
    ORDER BY q.order_number;
  ELSE
    -- Students get questions WITHOUT correct_answer, explanation, and model_answer
    RETURN QUERY
    SELECT 
      q.id,
      q.assignment_id,
      q.text,
      q.options,
      NULL::integer as correct_answer,
      NULL::text as explanation,
      q.order_number,
      q.created_at,
      q.question_type,
      NULL::text as model_answer
    FROM questions q
    WHERE q.assignment_id = _assignment_id
    ORDER BY q.order_number;
  END IF;
END;
$function$;