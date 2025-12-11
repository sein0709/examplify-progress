import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, BookOpen, ClipboardList, Award, Calendar, User, Clock, FileText, TrendingUp, LogOut, Paperclip, ExternalLink, Image as ImageIcon, PenLine } from "lucide-react";
import { FilePreview } from "@/components/FilePreview";
import { cn } from "@/lib/utils";
import { MathInput } from "@/components/MathInput";
import { MathDisplay } from "@/components/MathDisplay";

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: number | null;
  explanation: string | null;
  order_number: number;
  question_type: 'multiple_choice' | 'free_response';
  model_answer: string | null;
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
  assignment_type: 'quiz' | 'reading';
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
  completion?: {
    completed_at: string;
    notes: string | null;
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

interface StudentAnswerResult {
  question_id: string;
  is_correct: boolean | null;
  points_earned: number | null;
  feedback: string | null;
  graded_at: string | null;
}

const Student = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [textAnswers, setTextAnswers] = useState<{ [key: number]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionAnswers, setSubmissionAnswers] = useState<StudentAnswerResult[]>([]);
  const [togglingCompletion, setTogglingCompletion] = useState(false);
  const [completionNotes, setCompletionNotes] = useState<{ [key: string]: string }>({});

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

      // Fetch completions for reading assignments
      const { data: completionsData } = await supabase
        .from("assignment_completions")
        .select("assignment_id, completed_at, notes")
        .eq("student_id", user.id);
      
      const completionsMap: {[key: string]: {completed_at: string, notes: string | null}} = {};
      (completionsData || []).forEach(c => {
        completionsMap[c.assignment_id] = { completed_at: c.completed_at, notes: c.notes };
      });

      // Fetch questions separately using secure function that hides answers from students
      const formattedAssignments = await Promise.all(
        (data || []).map(async (assignment: any) => {
          // Only fetch questions for quiz type
          let questions: Question[] = [];
          if (assignment.assignment_type === 'quiz') {
            const { data: questionsData } = await supabase.rpc(
              "get_assignment_questions",
              { _assignment_id: assignment.id, _include_answers: false }
            );

            // Transform RPC data to match Question interface
            questions = (questionsData || []).map((q: any) => ({
              id: q.id,
              text: q.text,
              options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
              correct_answer: q.correct_answer,
              explanation: q.explanation,
              order_number: q.order_number,
              question_type: q.question_type || 'multiple_choice',
              model_answer: q.model_answer,
            })).sort((a: Question, b: Question) => a.order_number - b.order_number);
          }

          // Count submissions for current student
          const studentSubmissions = assignment.submissions.filter(
            (sub: any) => sub && user && sub.student_id === user.id
          );
          const submissionCount = studentSubmissions.length;

          return {
            ...assignment,
            assignment_type: assignment.assignment_type as 'quiz' | 'reading',
            questions,
            submission: studentSubmissions[studentSubmissions.length - 1], // Most recent submission
            submission_count: submissionCount,
            completion: completionsMap[assignment.id] || null,
          };
        })
      );

      setAssignments(formattedAssignments);
    } catch (error: any) {
      toast.error("과제를 불러오지 못했습니다: " + error.message);
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
      toast.error("제출 기록을 불러오지 못했습니다: " + error.message);
    }
  };

  const toggleCompletion = async (assignment: Assignment, checked: boolean) => {
    if (!user) return;
    setTogglingCompletion(true);
    try {
      if (!checked) {
        // Remove completion
        const { error } = await supabase
          .from("assignment_completions")
          .delete()
          .eq("assignment_id", assignment.id)
          .eq("student_id", user.id);
        
        if (error) throw error;
        setCompletionNotes(prev => {
          const updated = { ...prev };
          delete updated[assignment.id];
          return updated;
        });
        toast.success("완료 표시가 취소되었습니다");
      } else {
        // Add completion with notes
        const notes = completionNotes[assignment.id] || null;
        const { error } = await supabase
          .from("assignment_completions")
          .insert({
            assignment_id: assignment.id,
            student_id: user.id,
            notes,
          });
        
        if (error) throw error;
        toast.success("완료 표시되었습니다!");
      }
      fetchAssignments();
    } catch (error: any) {
      toast.error("완료 상태 변경 실패: " + error.message);
    } finally {
      setTogglingCompletion(false);
    }
  };

  const updateCompletionNotes = async (assignment: Assignment, notes: string) => {
    if (!user || !assignment.completion) return;
    try {
      const { error } = await supabase
        .from("assignment_completions")
        .update({ notes })
        .eq("assignment_id", assignment.id)
        .eq("student_id", user.id);
      
      if (error) throw error;
      toast.success("메모가 저장되었습니다");
      fetchAssignments();
    } catch (error: any) {
      toast.error("메모 저장 실패: " + error.message);
    }
  };

  const startAssignment = (assignment: Assignment) => {
    setCurrentAssignment(assignment);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setTextAnswers({});
    setShowResults(false);
  };

  const handleAnswerSelect = (questionIndex: number, answer: number) => {
    setSelectedAnswers({ ...selectedAnswers, [questionIndex]: answer });
  };

  const handleTextAnswerChange = (questionIndex: number, answer: string) => {
    setTextAnswers({ ...textAnswers, [questionIndex]: answer });
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
        toast.error(`이 과제의 최대 제출 횟수(${currentAssignment.max_attempts}회)에 도달했습니다`);
        return;
      }
    }

    const allQuestionsAnswered = currentAssignment.questions.every(
      (question, index) => {
        if (question.question_type === 'free_response') {
          return textAnswers[index] && textAnswers[index].trim() !== '';
        }
        return selectedAnswers[index] !== undefined;
      }
    );

    if (!allQuestionsAnswered) {
      toast.error("모든 문제에 답을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      // Prepare student answers for the edge function
      const studentAnswers = currentAssignment.questions.map((question, index) => ({
        question_id: question.id,
        selected_answer: question.question_type === 'multiple_choice' ? selectedAnswers[index] : null,
        text_answer: question.question_type === 'free_response' ? textAnswers[index] : null,
        question_type: question.question_type,
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
        throw new Error(scoreError.message || "Failed to calculate score");
      }

      // Check if the response contains an error
      if (scoreData?.error) {
        console.error("Score calculation returned error:", scoreData.error);
        throw new Error(scoreData.error);
      }

      if (!scoreData || typeof scoreData.score !== 'number' || typeof scoreData.total_questions !== 'number') {
        console.error("Invalid score data received:", scoreData);
        throw new Error("Invalid response from score calculation");
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
        text_answer: answer.text_answer,
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

      // Fetch student answers with grading info
      const { data: savedAnswers } = await supabase
        .from("student_answers")
        .select("question_id, is_correct, points_earned, feedback, graded_at")
        .eq("submission_id", submission.id);
      
      if (savedAnswers) {
        setSubmissionAnswers(savedAnswers as StudentAnswerResult[]);
      }

      toast.success("과제가 제출되었습니다!");
      setShowResults(true);
      fetchAssignments();
      fetchMySubmissions();
    } catch (error: any) {
      toast.error("과제 제출 실패: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateScore = () => {
    // Score calculation now happens server-side for security
    // This function is kept for displaying results after submission
    // Only counts multiple choice questions
    if (!currentAssignment) return 0;
    let score = 0;
    currentAssignment.questions.forEach((question, index) => {
      if (question.question_type === 'multiple_choice' && selectedAnswers[index] === question.correct_answer) {
        score++;
      }
    });
    return score;
  };

  const getMCQuestionCount = () => {
    if (!currentAssignment) return 0;
    return currentAssignment.questions.filter(q => q.question_type === 'multiple_choice').length;
  };

  const getFRQuestionCount = () => {
    if (!currentAssignment) return 0;
    return currentAssignment.questions.filter(q => q.question_type === 'free_response').length;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">과제를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (currentAssignment && !showResults) {
    const multipleChoiceCount = currentAssignment.questions.filter(q => q.question_type === 'multiple_choice').length;
    const freeResponseCount = currentAssignment.questions.filter(q => q.question_type === 'free_response').length;
    const answeredMC = Object.keys(selectedAnswers).length;
    const answeredFR = Object.values(textAnswers).filter(a => a && a.trim() !== '').length;
    const answeredCount = answeredMC + answeredFR;
    const totalQuestions = currentAssignment.questions.length;
    const progress = (answeredCount / totalQuestions) * 100;

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
                {answeredCount} / {totalQuestions} 완료
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
                  과제 참고 자료
                </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <FilePreview 
                    fileUrl={currentAssignment.file_url!}
                    fileType={currentAssignment.file_type}
                    maxHeight="600px"
                  />
                </CardContent>
              </Card>
            )}

            {/* Right: OMR Answer Sheet */}
            <div className="h-full flex flex-col space-y-4">
              <Card className="flex-1 flex flex-col shadow-xl border-2">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    OMR 답안지
                  </CardTitle>
                  <CardDescription>
                    각 문제의 답안을 선택하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-4">
                  <div className="space-y-1">
                    {/* Header row */}
                    <div className="flex items-center gap-2 pb-2 border-b sticky top-0 bg-card z-10">
                      <div className="w-16 text-center text-sm font-medium text-muted-foreground">Q#</div>
                      <div className="flex-1 flex justify-center gap-4">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <div key={num} className="w-10 text-center text-sm font-medium text-muted-foreground">
                            {num}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Question rows */}
                    {currentAssignment.questions.map((question, qIndex) => {
                      const isAnswered = question.question_type === 'multiple_choice' 
                        ? selectedAnswers[qIndex] !== undefined
                        : textAnswers[qIndex] && textAnswers[qIndex].trim() !== '';
                      
                      return (
                        <div 
                          key={question.id} 
                          className={cn(
                            "py-3 px-1 rounded-lg transition-colors border-b",
                            isAnswered && "bg-accent/20"
                          )}
                        >
                          {question.question_type === 'multiple_choice' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 text-center">
                                <span className={cn(
                                  "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors",
                                  isAnswered 
                                    ? "bg-primary text-primary-foreground" 
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {qIndex + 1}
                                </span>
                              </div>
                              <div className="flex-1 flex justify-center gap-4">
                                {[0, 1, 2, 3, 4].map((optionIndex) => {
                                  const isSelected = selectedAnswers[qIndex] === optionIndex;
                                  return (
                                    <button
                                      key={optionIndex}
                                      type="button"
                                      onClick={() => handleAnswerSelect(qIndex, optionIndex)}
                                      className={cn(
                                        "w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-200",
                                        "hover:scale-110 hover:shadow-md",
                                        isSelected
                                          ? "bg-[#292929] border-[#292929] text-white shadow-lg scale-105 animate-scale-in ring-2 ring-[#292929]/30"
                                          : "border-border bg-background hover:border-primary/50 hover:bg-accent/30"
                                      )}
                                    >
                                      {optionIndex + 1}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 text-center">
                                  <span className={cn(
                                    "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors",
                                    isAnswered 
                                      ? "bg-purple-600 text-white" 
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {qIndex + 1}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  <PenLine className="h-3 w-3 mr-1" />
                                  서술형
                                </Badge>
                                <span className="text-sm text-muted-foreground flex-1">{question.text}</span>
                              </div>
                              <div className="pl-16">
                                <MathInput
                                  value={textAnswers[qIndex] || ''}
                                  onChange={(value) => handleTextAnswerChange(qIndex, value)}
                                  placeholder="답안을 입력하세요 (수학 기호 사용 가능)"
                                  className="max-w-xl"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button with Confirmation */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={submitting || answeredCount < totalQuestions}
                    size="lg"
                    className="w-full hover:scale-[1.02] transition-transform shadow-lg hover:shadow-xl bg-gradient-to-r from-primary to-primary/90"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        제출 중...
                      </>
                    ) : (
                      <>
                        과제 제출 ({answeredCount}/{totalQuestions})
                        <CheckCircle2 className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>과제를 제출하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      제출 후에는 답안을 수정할 수 없습니다. {totalQuestions}개 문항 중 {answeredCount}개를 답변하셨습니다.
                      {currentAssignment.is_resubmittable && currentAssignment.max_attempts && (
                        <span className="block mt-2 text-primary font-medium">
                          재제출 가능: {currentAssignment.max_attempts - (currentAssignment.submission_count || 0)}회 남음
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
                      {submitting ? "제출 중..." : "제출하기"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
              <CardTitle className="text-center text-3xl">🎉 과제 완료! 🎉</CardTitle>
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
                    {percentage >= 80 ? "훌륭합니다! 🌟" : percentage >= 60 ? "잘했습니다! 💪" : "더 열심히 해보세요! 📚"}
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
                  과제 참고 자료
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilePreview 
                  fileUrl={currentAssignment.file_url!}
                  fileType={currentAssignment.file_type}
                  maxHeight="400px"
                  showDownloadButton
                />
              </CardContent>
            </Card>
          )}

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                답안 확인
              </CardTitle>
              <CardDescription>
                어떤 문제를 맞았는지 확인하고 설명을 학습하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentAssignment.questions.map((question, index) => {
                const isFreeResponse = question.question_type === 'free_response';
                const selectedAnswer = selectedAnswers[index];
                const textAnswer = textAnswers[index];
                const isCorrect = !isFreeResponse && selectedAnswer === question.correct_answer;
                
                // Get submission answer for FRQ grading info
                const submissionAnswer = submissionAnswers.find(a => a.question_id === question.id);
                const frqPoints = submissionAnswer?.points_earned;
                const frqGraded = frqPoints !== null && frqPoints !== undefined;
                const frqFeedback = submissionAnswer?.feedback;

                // Determine FRQ card styling based on grading status
                const frqBorderClass = frqGraded 
                  ? frqPoints === 1 
                    ? "border-green-500/50 bg-green-500/5"
                    : frqPoints === 0 
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-yellow-500/50 bg-yellow-500/5"
                  : "border-purple-500/50 bg-purple-500/5";

                return (
                  <Card key={question.id} className={cn(
                    "border-2 transition-all duration-300 hover:shadow-lg",
                    isFreeResponse 
                      ? frqBorderClass
                      : isCorrect 
                        ? "border-green-500/50 bg-green-500/5" 
                        : "border-destructive/50 bg-destructive/5"
                  )}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {isFreeResponse ? (
                          frqGraded ? (
                            frqPoints === 1 ? (
                              <div className="relative">
                                <div className="absolute inset-0 blur-lg bg-green-500/30" />
                                <CheckCircle2 className="h-6 w-6 text-green-500 relative" />
                              </div>
                            ) : frqPoints === 0 ? (
                              <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                                <span className="text-sm text-destructive-foreground font-bold">✕</span>
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center">
                                <span className="text-xs text-white font-bold">{Math.round(frqPoints * 100)}%</span>
                              </div>
                            )
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center">
                              <PenLine className="h-3 w-3 text-white" />
                            </div>
                          )
                        ) : isCorrect ? (
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
                            문제 {index + 1}
                            {isFreeResponse ? (
                              <>
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  서술형
                                </Badge>
                                {frqGraded ? (
                                  <Badge 
                                    variant={frqPoints === 1 ? "default" : frqPoints === 0 ? "destructive" : "secondary"}
                                    className={cn(
                                      frqPoints === 1 && "bg-green-500",
                                      frqPoints !== null && frqPoints > 0 && frqPoints < 1 && "bg-yellow-500 text-white"
                                    )}
                                  >
                                    {Math.round(frqPoints! * 100)}% ({frqPoints} 점)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-purple-600 border-purple-400">
                                    채점 대기중
                                  </Badge>
                                )}
                              </>
                            ) : isCorrect ? (
                              <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">정답</span>
                            ) : null}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{question.text}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isFreeResponse ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-muted/50 rounded-lg border">
                            <p className="text-sm font-semibold mb-2">내 답안:</p>
                            {textAnswer ? (
                              <MathDisplay latex={textAnswer} block />
                            ) : (
                              <span className="text-muted-foreground italic">답안 없음</span>
                            )}
                          </div>
                          {question.model_answer && (
                            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                              <p className="text-sm font-semibold mb-2 text-green-700 dark:text-green-300">모범답안:</p>
                              <MathDisplay latex={question.model_answer} block />
                            </div>
                          )}
                          {frqFeedback && (
                            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                              <p className="text-sm font-semibold mb-2 text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                강사 피드백:
                              </p>
                              <p className="text-sm">{frqFeedback}</p>
                            </div>
                          )}
                        </div>
                      ) : (
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
                      )}

                      {question.explanation && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-muted to-muted/50 rounded-lg border-l-4 border-primary">
                          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            설명:
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
            과제 목록으로 돌아가기
          </Button>

          {currentAssignment.is_resubmittable && (
            <Card className="border-2 border-accent/50 bg-accent/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-5 w-5 text-accent" />
                  <div>
                    {currentAssignment.max_attempts ? (
                      <p className="font-medium">
                        <span className="font-bold">{currentAssignment.max_attempts}</span>회 중 <span className="font-bold">{(currentAssignment.submission_count || 0) + 1}</span>회 제출했습니다.
                        {(currentAssignment.max_attempts - ((currentAssignment.submission_count || 0) + 1)) > 0 ? (
                          <span className="text-accent ml-1">
                            {currentAssignment.max_attempts - ((currentAssignment.submission_count || 0) + 1)}회 제출 가능합니다.
                          </span>
                        ) : (
                          <span className="text-muted-foreground ml-1">
                            최대 제출 횟수에 도달했습니다.
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="font-medium">
                        이 과제는 무제한 재제출이 가능합니다. 언제든지 점수를 향상시킬 수 있습니다!
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
    
    if (diffInDays === 0) return "오늘";
    if (diffInDays === 1) return "어제";
    if (diffInDays < 7) return `${diffInDays}일 전`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}주 전`;
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
                학생 포털
              </h1>
              <p className="text-muted-foreground mt-1">다시 오신 것을 환영합니다!</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>

        <Tabs defaultValue="assignments" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span>과제</span>
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>나의 현황</span>
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
                        배정된 과제가 없습니다
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        강사가 과제를 배정하면 여기에 표시됩니다
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment, index) => {
                  const isReading = assignment.assignment_type === 'reading';
                  const percentage = assignment.submission 
                    ? Math.round((assignment.submission.score / assignment.submission.total_questions) * 100)
                    : 0;
                  const scoreColor = percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-yellow-500" : "bg-red-500";
                  
                  return (
                    <Card 
                      key={assignment.id} 
                      className={cn(
                        "shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] border-2 hover:border-primary/50 animate-fade-in",
                        isReading && "border-l-4 border-l-accent"
                      )}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <CardTitle className="text-xl flex items-center gap-2">
                              {isReading ? (
                                <BookOpen className="h-5 w-5 text-accent" />
                              ) : (
                                <ClipboardList className="h-5 w-5" color="#474747" />
                              )}
                              {assignment.title}
                              <Badge variant={isReading ? 'secondary' : 'default'} className="ml-2">
                                {isReading ? '비퀴즈 과제' : '퀴즈'}
                              </Badge>
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {assignment.instructor?.full_name || "강사 미지정"}
                              </span>
                              {assignment.due_date && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  isOverdue(assignment.due_date) && "text-red-500 font-semibold",
                                  isDueSoon(assignment.due_date) && "text-yellow-600 font-semibold"
                                )}>
                                  <Calendar className="h-3 w-3" />
                                  마감일: {new Date(assignment.due_date).toLocaleDateString()}
                                  {isOverdue(assignment.due_date) && " (마감됨)"}
                                  {isDueSoon(assignment.due_date) && " (마감 임박)"}
                                </span>
                              )}
                              {!isReading && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {assignment.questions.length}문제
                                </span>
                              )}
                              {assignment.file_url && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  첨부파일
                                </Badge>
                              )}
                              {!isReading && assignment.is_resubmittable && assignment.submission && (
                                <Badge variant="outline" className="flex items-center gap-1 text-foreground">
                                  <Clock className="h-3 w-3" />
                                  {assignment.max_attempts 
                                    ? `${assignment.submission_count || 0}/${assignment.max_attempts}회 제출` 
                                    : "무제한 제출"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            {isReading ? (
                              assignment.completion ? (
                                <Badge className="shadow-md bg-green-500 text-white">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  완료됨
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="shadow-md">
                                  미완료
                                </Badge>
                              )
                            ) : assignment.submission ? (
                              <Badge variant="secondary" className={cn("shadow-md", scoreColor, "text-white")}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {percentage}% ({assignment.submission.score}/{assignment.submission.total_questions})
                              </Badge>
                            ) : (
                              <Badge className="shadow-md">
                                미시작
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isReading ? (
                          <div className="space-y-4">
                            {assignment.description && (
                              <p className="text-muted-foreground">{assignment.description}</p>
                            )}
                            {assignment.file_url && (
                              <div className="p-4 border rounded-lg bg-muted/30">
                                <FilePreview 
                                  fileUrl={assignment.file_url}
                                  fileType={assignment.file_type}
                                  maxHeight="400px"
                                  showDownloadButton
                                />
                              </div>
                            )}
                            <div className="space-y-3">
                              <Textarea
                                placeholder="배운 내용이나 메모를 입력하세요 (선택사항)"
                                value={assignment.completion?.notes || completionNotes[assignment.id] || ''}
                                onChange={(e) => {
                                  if (assignment.completion) {
                                    // If already completed, update in db on blur
                                    setCompletionNotes(prev => ({ ...prev, [assignment.id]: e.target.value }));
                                  } else {
                                    setCompletionNotes(prev => ({ ...prev, [assignment.id]: e.target.value }));
                                  }
                                }}
                                onBlur={() => {
                                  if (assignment.completion && completionNotes[assignment.id] !== undefined) {
                                    updateCompletionNotes(assignment, completionNotes[assignment.id]);
                                  }
                                }}
                                className="min-h-[80px] text-sm"
                              />
                              <div className="flex items-center space-x-3">
                                <Checkbox 
                                  id={`completion-${assignment.id}`}
                                  checked={!!assignment.completion}
                                  onCheckedChange={(checked) => toggleCompletion(assignment, !!checked)}
                                  disabled={togglingCompletion}
                                />
                                <Label 
                                  htmlFor={`completion-${assignment.id}`} 
                                  className="text-sm font-medium leading-none cursor-pointer"
                                >
                                  완료 표시
                                </Label>
                                {togglingCompletion && <Loader2 className="h-4 w-4 animate-spin" />}
                              </div>
                            </div>
                            {assignment.completion && (
                              <p className="text-xs text-muted-foreground">
                                완료일: {new Date(assignment.completion.completed_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : !assignment.submission ? (
                          <Button 
                            onClick={() => startAssignment(assignment)}
                            className="w-full hover:scale-[1.02] transition-transform shadow-md"
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            과제 시작
                          </Button>
                        ) : assignment.is_resubmittable && 
                           (!assignment.max_attempts || (assignment.submission_count || 0) < assignment.max_attempts) ? (
                          <Button 
                            onClick={() => startAssignment(assignment)}
                            variant="outline"
                            className="w-full hover:scale-[1.02] transition-transform shadow-md"
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            과제 재시작
                            {assignment.max_attempts && (
                              <span className="ml-2 text-xs">
                                ({(assignment.max_attempts - (assignment.submission_count || 0))}회 남음)
                              </span>
                            )}
                          </Button>
                        ) : assignment.submission && assignment.is_resubmittable && 
                           assignment.max_attempts && (assignment.submission_count || 0) >= assignment.max_attempts ? (
                          <div className="text-sm text-muted-foreground text-center py-2">
                            최대 제출 횟수 도달
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
                  제출 기록
                </CardTitle>
                <CardDescription>나의 학습 진도와 제출 기록을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                {mySubmissions.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                    <div>
                      <p className="text-xl font-semibold text-muted-foreground">
                        제출 기록이 없습니다
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        첫 과제를 완료하면 여기에 기록이 표시됩니다
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>과제</TableHead>
                          <TableHead>점수</TableHead>
                          <TableHead>백분율</TableHead>
                          <TableHead>제출일</TableHead>
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
