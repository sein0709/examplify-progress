import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { assignment_id, student_answers } = requestBody;
    
    console.log(`Processing submission for assignment: ${assignment_id}, answers count: ${student_answers?.length || 0}`);
    
    if (!assignment_id || !student_answers || !Array.isArray(student_answers)) {
      console.error('Missing required fields:', { assignment_id, hasAnswers: !!student_answers, isArray: Array.isArray(student_answers) });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: assignment_id and student_answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch questions with correct answers (using service role key)
    console.log(`Fetching questions for assignment: ${assignment_id}`);
    const { data: questions, error: questionsError } = await supabase
      .rpc('get_assignment_questions', {
        _assignment_id: assignment_id,
        _include_answers: true
      });

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch questions: ${questionsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!questions || questions.length === 0) {
      console.error('No questions found for assignment:', assignment_id);
      return new Response(
        JSON.stringify({ error: 'No questions found for this assignment' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${questions.length} questions for assignment`);

    // Calculate score
    let score = 0;
    const questionMap = new Map(questions.map((q: any) => [q.id, q.correct_answer]));

    for (const answer of student_answers) {
      const correctAnswer = questionMap.get(answer.question_id);
      if (correctAnswer !== undefined && answer.selected_answer === correctAnswer) {
        score++;
      }
    }

    console.log(`Score calculated: ${score}/${questions.length} for assignment ${assignment_id}`);

    return new Response(
      JSON.stringify({ 
        score,
        total_questions: questions.length 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in calculate-submission-score function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
