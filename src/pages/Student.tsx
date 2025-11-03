import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: number;
  order_number: number;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  instructor: {
    full_name: string;
  };
  questions: Question[];
  submission?: {
    id: string;
    score: number;
    total_questions: number;
  };
}

interface Submission {
  id: string;
  score: number;
  total_questions: number;
  submitted_at: string;
  assignment: {
    title: string;
  };
}

const Student = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchMySubmissions();
  }, [user]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          instructor:profiles!instructor_id(full_name),
          questions(*),
          submissions!submissions_assignment_id_fkey!left(id, score, total_questions)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedAssignments = (data || []).map((assignment: any) => ({
        ...assignment,
        questions: assignment.questions.sort(
          (a: Question, b: Question) => a.order_number - b.order_number
        ),
        submission: assignment.submissions.find(
          (sub: any) => sub && user && sub.student_id === user.id
        ),
      }));

      setAssignments(formattedAssignments);
    } catch (error: any) {
      toast.error("Failed to fetch assignments: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMySubmissions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          assignment:assignments(title)
        `)
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setMySubmissions(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch submissions: " + error.message);
    }
  };

  const startAssignment = (assignment: Assignment) => {
    setCurrentAssignment(assignment);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
  };

  const handleAnswerSelect = (answer: number) => {
    setSelectedAnswers({ ...selectedAnswers, [currentQuestionIndex]: answer });
  };

  const handleNext = () => {
    if (currentAssignment && currentQuestionIndex < currentAssignment.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentAssignment || !user) return;

    const allQuestionsAnswered = currentAssignment.questions.every(
      (_, index) => selectedAnswers[index] !== undefined
    );

    if (!allQuestionsAnswered) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    setSubmitting(true);
    try {
      let score = 0;
      currentAssignment.questions.forEach((question, index) => {
        if (selectedAnswers[index] === question.correct_answer) {
          score++;
        }
      });

      const { data: submission, error: submissionError } = await supabase
        .from("submissions")
        .insert({
          assignment_id: currentAssignment.id,
          student_id: user.id,
          score,
          total_questions: currentAssignment.questions.length,
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      const answersToInsert = currentAssignment.questions.map((question, index) => ({
        submission_id: submission.id,
        question_id: question.id,
        selected_answer: selectedAnswers[index],
      }));

      const { error: answersError } = await supabase
        .from("student_answers")
        .insert(answersToInsert);

      if (answersError) throw answersError;

      toast.success("Assignment submitted successfully!");
      setShowResults(true);
      fetchAssignments();
      fetchMySubmissions();
    } catch (error: any) {
      toast.error("Failed to submit assignment: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateScore = () => {
    if (!currentAssignment) return 0;
    let score = 0;
    currentAssignment.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correct_answer) {
        score++;
      }
    });
    return score;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (currentAssignment && !showResults) {
    const currentQuestion = currentAssignment.questions[currentQuestionIndex];
    const progress =
      ((currentQuestionIndex + 1) / currentAssignment.questions.length) * 100;

    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentAssignment(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{currentAssignment.title}</h1>
            <div className="w-10" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Question {currentQuestionIndex + 1} of{" "}
                {currentAssignment.questions.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{currentQuestion.text}</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={selectedAnswers[currentQuestionIndex]?.toString() || ""}
                onValueChange={(value) => handleAnswerSelect(parseInt(value))}
              >
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-accent cursor-pointer"
                    >
                      <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                      <Label
                        htmlFor={`option-${index}`}
                        className="flex-1 cursor-pointer"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {currentQuestionIndex === currentAssignment.questions.length - 1 ? (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Assignment"
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showResults && currentAssignment) {
    const score = calculateScore();
    const percentage = Math.round(
      (score / currentAssignment.questions.length) * 100
    );

    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Assignment Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <div className="text-center">
                  <p className="text-4xl font-bold">
                    {score} / {currentAssignment.questions.length}
                  </p>
                  <p className="text-xl text-muted-foreground">{percentage}%</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  setShowResults(false);
                  setCurrentAssignment(null);
                }}
                className="w-full"
              >
                Back to Assignments
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Student Portal</h1>
        </div>

        <Tabs defaultValue="assignments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assignments">Available Assignments</TabsTrigger>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments">
            {assignments.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">
                    No assignments available
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{assignment.title}</CardTitle>
                          <CardDescription>
                            By {assignment.instructor.full_name}
                            {assignment.due_date && (
                              <> • Due {new Date(assignment.due_date).toLocaleDateString()}</>
                            )}
                          </CardDescription>
                        </div>
                        {assignment.submission ? (
                          <Badge variant="secondary">
                            Completed ({assignment.submission.score}/
                            {assignment.submission.total_questions})
                          </Badge>
                        ) : (
                          <Badge>Not Started</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {assignment.questions.length} questions
                        </p>
                        {!assignment.submission && (
                          <Button onClick={() => startAssignment(assignment)}>
                            Start Assignment
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle>My Submissions</CardTitle>
                <CardDescription>View your past assignment submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {mySubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No submissions yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mySubmissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {submission.assignment.title}
                          </TableCell>
                          <TableCell>
                            {submission.score}/{submission.total_questions}
                          </TableCell>
                          <TableCell>
                            {Math.round(
                              (submission.score / submission.total_questions) * 100
                            )}
                            %
                          </TableCell>
                          <TableCell>
                            {new Date(submission.submitted_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Student;
