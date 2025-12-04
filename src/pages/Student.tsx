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
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, BookOpen, ClipboardList, Award, Calendar, User, Clock, FileText, TrendingUp, LogOut, Paperclip, ExternalLink, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  order_number: number;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  file_url: string | null;
  file_type: string | null;
  is_resubmittable: boolean;
  max_attempts: number | null;
  instructor: {
    full_name: string;
  };
  questions: Question[];
  submission?: {
    id: string;
    score: number;
    total_questions: number;
  };
  submission_count?: number;
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
  const { user, signOut } = useAuth();
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
    if (!user) return;
    setLoading(true);
    try {
      // First fetch the assignment IDs that this student is assigned to
      const { data: assignedData, error: assignedError } = await supabase
        .from("student_assignments")
        .select("assignment_id")
        .eq("student_id", user.id);

      if (assignedError) throw assignedError;

      const assignedIds = (assignedData || []).map(a => a.assignment_id);

      // If no assignments are assigned, show empty list
      if (assignedIds.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          instructor:profiles!instructor_id(full_name),
          submissions!submissions_assignment_id_fkey!left(id, score, total_questions, student_id)
        `)
        .in("id", assignedIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch questions separately using secure function that hides answers from students
      const formattedAssignments = await Promise.all(
        (data || []).map(async (assignment: any) => {
          const { data: questionsData } = await supabase.rpc(
            "get_assignment_questions",
            { _assignment_id: assignment.id, _include_answers: false }
          );

          // Transform RPC data to match Question interface
          const questions = (questionsData || []).map((q: any) => ({
            id: q.id,
            text: q.text,
            options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            order_number: q.order_number,
          })).sort((a: Question, b: Question) => a.order_number - b.order_number);

          // Count submissions for current student
          const studentSubmissions = assignment.submissions.filter(
            (sub: any) => sub && user && sub.student_id === user.id
          );
          const submissionCount = studentSubmissions.length;

          return {
            ...assignment,
            questions,
            submission: studentSubmissions[studentSubmissions.length - 1], // Most recent submission
            submission_count: submissionCount,
          };
        })
      );

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

    // Check if student has exceeded max attempts
    if (currentAssignment.max_attempts && currentAssignment.submission_count) {
      if (currentAssignment.submission_count >= currentAssignment.max_attempts) {
        toast.error(`You have reached the maximum number of attempts (${currentAssignment.max_attempts}) for this assignment`);
        return;
      }
    }

    const allQuestionsAnswered = currentAssignment.questions.every(
      (_, index) => selectedAnswers[index] !== undefined
    );

    if (!allQuestionsAnswered) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    setSubmitting(true);
    try {
      // Prepare student answers for the edge function
      const studentAnswers = currentAssignment.questions.map((question, index) => ({
        question_id: question.id,
        selected_answer: selectedAnswers[index],
      }));

      // Calculate score on the server
      const { data: scoreData, error: scoreError } = await supabase.functions.invoke(
        'calculate-submission-score',
        {
          body: {
            assignment_id: currentAssignment.id,
            student_answers: studentAnswers,
          },
        }
      );

      if (scoreError) {
        console.error("Score calculation error:", scoreError);
        throw new Error("Failed to calculate score");
      }

      const { score: finalScore, total_questions: totalQuestions } = scoreData;

      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from("submissions")
        .insert({
          assignment_id: currentAssignment.id,
          student_id: user.id,
          score: finalScore,
          total_questions: totalQuestions,
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Insert individual answers
      const answersToInsert = studentAnswers.map((answer) => ({
        submission_id: submission.id,
        question_id: answer.question_id,
        selected_answer: answer.selected_answer,
      }));

      const { error: answersError } = await supabase
        .from("student_answers")
        .insert(answersToInsert);

      if (answersError) throw answersError;

      // Fetch questions WITH correct answers for results display
      const { data: questionsWithAnswers } = await supabase.rpc(
        "get_assignment_questions",
        {
          _assignment_id: currentAssignment.id,
          _include_answers: true,
        }
      );

      // Update current assignment with questions that include correct answers
      if (questionsWithAnswers) {
        setCurrentAssignment({
          ...currentAssignment,
          questions: questionsWithAnswers as Question[],
        });
      }

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
    // Score calculation now happens server-side for security
    // This function is kept for displaying results after submission
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Loading your assignments...</p>
        </div>
      </div>
    );
  }

  if (currentAssignment && !showResults) {
    const currentQuestion = currentAssignment.questions[currentQuestionIndex];
    const progress =
      ((currentQuestionIndex + 1) / currentAssignment.questions.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentAssignment(null)}
              className="hover:scale-110 transition-transform"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {currentAssignment.title}
            </h1>
            <div className="w-10" />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">
                Question {currentQuestionIndex + 1} of{" "}
                {currentAssignment.questions.length}
              </span>
              <span className="text-primary font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-3 bg-secondary" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left: Preview */}
            {currentAssignment.file_url && (
              <Card className="h-full flex flex-col shadow-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Paperclip className="h-5 w-5" color="#474747" />
                    Assignment Reference Material
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {currentAssignment.file_type?.startsWith('image/') ? (
                    <div className="space-y-2">
                      <img 
                        src={currentAssignment.file_url} 
                        alt="Assignment reference" 
                        className="w-full rounded-lg border shadow-md max-h-[600px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-[600px] border rounded-lg overflow-hidden">
                      <iframe
                        src={currentAssignment.file_url!}
                        className="w-full h-full"
                        title="Assignment Reference Material"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Right: Marking Interface */}
            <div className="h-full flex flex-col space-y-6">
              <Card className="flex-1 flex flex-col shadow-xl border-2 hover:shadow-2xl transition-all duration-300 animate-scale-in">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl leading-relaxed">{currentQuestion.text}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={selectedAnswers[currentQuestionIndex]?.toString() || ""}
                    onValueChange={(value) => handleAnswerSelect(parseInt(value))}
                  >
                    <div className="space-y-3">
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = selectedAnswers[currentQuestionIndex] === index;
                        return (
                          <div
                            key={index}
                            className={cn(
                              "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                              "hover:scale-[1.02] hover:shadow-md",
                              isSelected 
                                ? "bg-accent/50 border-primary shadow-md scale-[1.02]" 
                                : "border-border hover:border-accent"
                            )}
                          >
                            <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                            <Label
                              htmlFor={`option-${index}`}
                              className={cn(
                                "flex-1 cursor-pointer text-base transition-colors",
                                isSelected && "font-medium text-foreground"
                              )}
                            >
                              {option}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              <div className="flex justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="hover:scale-105 transition-transform shadow-md"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentQuestionIndex === currentAssignment.questions.length - 1 ? (
                  <Button 
                    onClick={handleSubmit} 
                    disabled={submitting}
                    className="hover:scale-105 transition-transform shadow-lg hover:shadow-xl bg-gradient-to-r from-primary to-primary/90"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Assignment
                        <CheckCircle2 className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleNext}
                    className="hover:scale-105 transition-transform shadow-md"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
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
    const scoreColor = percentage >= 80 ? "text-green-500" : percentage >= 60 ? "text-yellow-500" : "text-red-500";
    const bgGradient = percentage >= 80 ? "from-green-500/10 to-green-500/5" : percentage >= 60 ? "from-yellow-500/10 to-yellow-500/5" : "from-red-500/10 to-red-500/5";

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <Card className={cn("shadow-xl border-2 bg-gradient-to-br", bgGradient)}>
            <CardHeader>
              <CardTitle className="text-center text-3xl">🎉 Assignment Complete! 🎉</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 blur-2xl opacity-50">
                    <Award className={cn("h-24 w-24", scoreColor)} />
                  </div>
                  <Award className={cn("h-24 w-24 relative animate-scale-in", scoreColor)} />
                </div>
                <div className="text-center space-y-2">
                  <p className={cn("text-6xl font-bold animate-scale-in", scoreColor)}>
                    {score} / {currentAssignment.questions.length}
                  </p>
                  <p className={cn("text-3xl font-semibold", scoreColor)}>{percentage}%</p>
                  <p className="text-muted-foreground text-lg">
                    {percentage >= 80 ? "Excellent work! 🌟" : percentage >= 60 ? "Good job! Keep it up! 💪" : "Keep practicing! 📚"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {currentAssignment.file_url && (
            <Card className="shadow-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="h-5 w-5 text-primary" />
                  Assignment Reference Material
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentAssignment.file_type?.startsWith('image/') ? (
                  <div className="space-y-2">
                    <img 
                      src={currentAssignment.file_url} 
                      alt="Assignment reference" 
                      className="w-full rounded-lg border shadow-md max-h-96 object-contain"
                    />
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open(currentAssignment.file_url!, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Open PDF Reference
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Review Your Answers
              </CardTitle>
              <CardDescription>
                See which questions you got right and learn from explanations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentAssignment.questions.map((question, index) => {
                const selectedAnswer = selectedAnswers[index];
                const isCorrect = selectedAnswer === question.correct_answer;

                return (
                  <Card key={question.id} className={cn(
                    "border-2 transition-all duration-300 hover:shadow-lg",
                    isCorrect ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5"
                  )}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <div className="relative">
                            <div className="absolute inset-0 blur-lg bg-green-500/30" />
                            <CheckCircle2 className="h-6 w-6 text-green-500 relative" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                            <span className="text-sm text-destructive-foreground font-bold">✕</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            Question {index + 1}
                            {isCorrect && <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">Correct</span>}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{question.text}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        {question.options.map((option, optIndex) => {
                          const isSelected = selectedAnswer === optIndex;
                          const isCorrectOption = optIndex === question.correct_answer;

                          return (
                            <div
                              key={optIndex}
                              className={cn(
                                "p-4 rounded-lg border-2 transition-all duration-200",
                                isCorrectOption && "bg-green-500/15 border-green-500 shadow-sm",
                                isSelected && !isCorrect && "bg-destructive/15 border-destructive"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {isCorrectOption && (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                )}
                                {isSelected && !isCorrect && (
                                  <div className="h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
                                    <span className="text-xs text-destructive-foreground font-bold">✕</span>
                                  </div>
                                )}
                                <span className={cn(
                                  "text-base",
                                  isCorrectOption && "font-semibold text-green-700 dark:text-green-300",
                                  isSelected && !isCorrect && "line-through opacity-60"
                                )}>
                                  {option}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {question.explanation && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-muted to-muted/50 rounded-lg border-l-4 border-primary">
                          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Explanation:
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>

          <Button
            onClick={() => {
              setShowResults(false);
              setCurrentAssignment(null);
            }}
            className="w-full h-12 text-base shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>

          {currentAssignment.is_resubmittable && (
            <Card className="border-2 border-accent/50 bg-accent/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-5 w-5 text-accent" />
                  <div>
                    {currentAssignment.max_attempts ? (
                      <p className="font-medium">
                        You have used <span className="font-bold">{(currentAssignment.submission_count || 0) + 1}</span> of <span className="font-bold">{currentAssignment.max_attempts}</span> attempts.
                        {(currentAssignment.max_attempts - ((currentAssignment.submission_count || 0) + 1)) > 0 ? (
                          <span className="text-accent ml-1">
                            You have {currentAssignment.max_attempts - ((currentAssignment.submission_count || 0) + 1)} attempt{currentAssignment.max_attempts - ((currentAssignment.submission_count || 0) + 1) !== 1 ? 's' : ''} remaining.
                          </span>
                        ) : (
                          <span className="text-muted-foreground ml-1">
                            You have reached the maximum number of attempts.
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="font-medium">
                        This assignment allows unlimited retakes. You can improve your score anytime!
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInDays = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return past.toLocaleDateString();
  };

  const isDueSoon = (dueDate: string | null) => {
    if (!dueDate) return false;
    const now = new Date();
    const due = new Date(dueDate);
    const diffInDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays <= 3 && diffInDays >= 0;
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              className="hover:scale-110 transition-transform"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Student Portal
              </h1>
              <p className="text-muted-foreground mt-1">Welcome back! Ready to learn?</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="assignments" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span>Assignments</span>
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>My Progress</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            {assignments.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="py-16">
                  <div className="text-center space-y-4">
                    <BookOpen className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                    <div>
                      <p className="text-xl font-semibold text-muted-foreground">
                        No assignments available
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Check back later for new assignments from your instructors
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment, index) => {
                  const percentage = assignment.submission 
                    ? Math.round((assignment.submission.score / assignment.submission.total_questions) * 100)
                    : 0;
                  const scoreColor = percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-yellow-500" : "bg-red-500";
                  
                  return (
                    <Card 
                      key={assignment.id} 
                      className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] border-2 hover:border-primary/50 animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <CardTitle className="text-xl flex items-center gap-2">
                              <BookOpen className="h-5 w-5" color="#474747" />
                              {assignment.title}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {assignment.instructor?.full_name || "Unknown Instructor"}
                              </span>
                              {assignment.due_date && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  isOverdue(assignment.due_date) && "text-red-500 font-semibold",
                                  isDueSoon(assignment.due_date) && "text-yellow-600 font-semibold"
                                )}>
                                  <Calendar className="h-3 w-3" />
                                  Due {new Date(assignment.due_date).toLocaleDateString()}
                                  {isOverdue(assignment.due_date) && " (Overdue)"}
                                  {isDueSoon(assignment.due_date) && " (Due Soon)"}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {assignment.questions.length} questions
                              </span>
                              {assignment.file_url && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  Attachment
                                </Badge>
                              )}
                              {assignment.is_resubmittable && assignment.submission && (
                                <Badge variant="outline" className="flex items-center gap-1 text-foreground">
                                  <Clock className="h-3 w-3" />
                                  {assignment.max_attempts 
                                    ? `${assignment.submission_count || 0}/${assignment.max_attempts} attempts` 
                                    : "Unlimited attempts"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            {assignment.submission ? (
                              <Badge variant="secondary" className={cn("shadow-md", scoreColor, "text-white")}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {percentage}% ({assignment.submission.score}/{assignment.submission.total_questions})
                              </Badge>
                            ) : (
                              <Badge className="shadow-md">
                                Not Started
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {!assignment.submission ? (
                          <Button 
                            onClick={() => startAssignment(assignment)}
                            className="w-full hover:scale-[1.02] transition-transform shadow-md"
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Start Assignment
                          </Button>
                        ) : assignment.is_resubmittable && 
                           (!assignment.max_attempts || (assignment.submission_count || 0) < assignment.max_attempts) ? (
                          <Button 
                            onClick={() => startAssignment(assignment)}
                            variant="outline"
                            className="w-full hover:scale-[1.02] transition-transform shadow-md"
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Retake Assignment
                            {assignment.max_attempts && (
                              <span className="ml-2 text-xs">
                                ({(assignment.max_attempts - (assignment.submission_count || 0))} attempts left)
                              </span>
                            )}
                          </Button>
                        ) : assignment.submission && assignment.is_resubmittable && 
                           assignment.max_attempts && (assignment.submission_count || 0) >= assignment.max_attempts ? (
                          <div className="text-sm text-muted-foreground text-center py-2">
                            Maximum attempts reached
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  My Submissions
                </CardTitle>
                <CardDescription>Track your progress and past submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {mySubmissions.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                    <div>
                      <p className="text-xl font-semibold text-muted-foreground">
                        No submissions yet
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Complete your first assignment to see your progress here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                        {mySubmissions.map((submission) => {
                          const percentage = Math.round((submission.score / submission.total_questions) * 100);
                          const scoreColor = percentage >= 80 ? "text-green-600 dark:text-green-400" : percentage >= 60 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
                          const bgColor = percentage >= 80 ? "bg-green-500/10" : percentage >= 60 ? "bg-yellow-500/10" : "bg-red-500/10";
                          
                          return (
                            <TableRow 
                              key={submission.id}
                              className="hover:bg-muted/50 transition-colors"
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  {submission.assignment.title}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold">
                                {submission.score}/{submission.total_questions}
                              </TableCell>
                              <TableCell>
                                <Badge className={cn("shadow-sm", bgColor, scoreColor, "border-0")}>
                                  {percentage >= 80 && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  {percentage}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(submission.submitted_at)}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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
