import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requester is an admin using the provided JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: requester },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requester) {
      console.error("delete-user: unauthorized requester", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requester has admin role
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.id)
      .eq("role", "admin")
      .single();

    if (roleError || !adminRole) {
      console.error("delete-user: admin access required", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("delete-user: starting deletion for", userId);

    // 1) Gather all assignments where this user is the instructor
    const { data: instructorAssignments, error: instructorAssignmentsError } =
      await supabaseAdmin
        .from("assignments")
        .select("id")
        .eq("instructor_id", userId);

    if (instructorAssignmentsError) {
      console.error("delete-user: error fetching instructor assignments", instructorAssignmentsError);
      throw instructorAssignmentsError;
    }

    const instructorAssignmentIds = (instructorAssignments || []).map((a) => a.id);

    // 2) Gather all submissions by this user (as student) or for their assignments (as instructor)
    const { data: relatedSubmissions, error: relatedSubmissionsError } =
      await supabaseAdmin
        .from("submissions")
        .select("id, assignment_id, student_id")
        .or(
          [
            `student_id.eq.${userId}`,
            instructorAssignmentIds.length
              ? `assignment_id.in.(${instructorAssignmentIds.join(",")})`
              : "assignment_id.eq.__none__",
          ].join(",")
        );

    if (relatedSubmissionsError) {
      console.error("delete-user: error fetching related submissions", relatedSubmissionsError);
      throw relatedSubmissionsError;
    }

    const submissionIds = (relatedSubmissions || []).map((s) => s.id);

    // 3) Delete student_answers tied to those submissions
    if (submissionIds.length > 0) {
      const { error: deleteAnswersError } = await supabaseAdmin
        .from("student_answers")
        .delete()
        .in("submission_id", submissionIds);

      if (deleteAnswersError) {
        console.error("delete-user: error deleting student_answers", deleteAnswersError);
        throw deleteAnswersError;
      }
    }

    // 4) Delete submissions themselves
    if (submissionIds.length > 0) {
      const { error: deleteSubmissionsError } = await supabaseAdmin
        .from("submissions")
        .delete()
        .in("id", submissionIds);

      if (deleteSubmissionsError) {
        console.error("delete-user: error deleting submissions", deleteSubmissionsError);
        throw deleteSubmissionsError;
      }
    }

    // 5) Delete assignment_completions and student_assignments where this user is the student
    const { error: deleteCompletionsError } = await supabaseAdmin
      .from("assignment_completions")
      .delete()
      .eq("student_id", userId);

    if (deleteCompletionsError) {
      console.error("delete-user: error deleting assignment_completions", deleteCompletionsError);
      throw deleteCompletionsError;
    }

    const { error: deleteStudentAssignmentsError } = await supabaseAdmin
      .from("student_assignments")
      .delete()
      .eq("student_id", userId);

    if (deleteStudentAssignmentsError) {
      console.error("delete-user: error deleting student_assignments", deleteStudentAssignmentsError);
      throw deleteStudentAssignmentsError;
    }

    // 6) If the user is an instructor, clean up their assignments, questions, and related data
    if (instructorAssignmentIds.length > 0) {
      // Delete questions for these assignments
      const { error: deleteQuestionsError } = await supabaseAdmin
        .from("questions")
        .delete()
        .in("assignment_id", instructorAssignmentIds);

      if (deleteQuestionsError) {
        console.error("delete-user: error deleting questions", deleteQuestionsError);
        throw deleteQuestionsError;
      }

      // Delete assignment_completions and student_assignments tied to these assignments
      const { error: deleteAssignmentCompletionsForAssignmentsError } =
        await supabaseAdmin
          .from("assignment_completions")
          .delete()
          .in("assignment_id", instructorAssignmentIds);

      if (deleteAssignmentCompletionsForAssignmentsError) {
        console.error(
          "delete-user: error deleting assignment_completions for assignments",
          deleteAssignmentCompletionsForAssignmentsError,
        );
        throw deleteAssignmentCompletionsForAssignmentsError;
      }

      const { error: deleteStudentAssignmentsForAssignmentsError } =
        await supabaseAdmin
          .from("student_assignments")
          .delete()
          .in("assignment_id", instructorAssignmentIds);

      if (deleteStudentAssignmentsForAssignmentsError) {
        console.error(
          "delete-user: error deleting student_assignments for assignments",
          deleteStudentAssignmentsForAssignmentsError,
        );
        throw deleteStudentAssignmentsForAssignmentsError;
      }

      // Finally delete the assignments themselves
      const { error: deleteAssignmentsError } = await supabaseAdmin
        .from("assignments")
        .delete()
        .in("id", instructorAssignmentIds);

      if (deleteAssignmentsError) {
        console.error("delete-user: error deleting assignments", deleteAssignmentsError);
        throw deleteAssignmentsError;
      }
    }

    // 7) Null out graded_by where this user graded answers (to avoid FKs)
    const { error: nullGradedByError } = await supabaseAdmin
      .from("student_answers")
      .update({ graded_by: null })
      .eq("graded_by", userId);

    if (nullGradedByError) {
      console.error("delete-user: error nulling graded_by", nullGradedByError);
      throw nullGradedByError;
    }

    // 8) Delete from user_roles and profiles
    const { error: deleteRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRolesError) {
      console.error("delete-user: error deleting user_roles", deleteRolesError);
      throw deleteRolesError;
    }

    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (deleteProfileError) {
      console.error("delete-user: error deleting profile", deleteProfileError);
      throw deleteProfileError;
    }

    // 9) Finally delete from auth.users so they can re-register
    const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthUserError) {
      console.error("delete-user: error deleting auth user", deleteAuthUserError);
      throw deleteAuthUserError;
    }

    console.log("delete-user: successfully deleted user", userId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
