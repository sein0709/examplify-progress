import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, PenLine, Save } from "lucide-react";
import { MathDisplay } from "@/components/MathDisplay";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface StudentAnswer {
  id: string;
  question_id: string;
  selected_answer: number | null;
  text_answer: string | null;
  is_correct: boolean | null;
  feedback: string | null;
  graded_at: string | null;
  question: {
    id: string;
    text: string;
    question_type: string;
    model_answer: string | null;
    order_number: number;
  };
}

interface FRQGradingDialogProps {
  submissionId: string;
  studentName: string;
  onGradingComplete?: () => void;
}

export const FRQGradingDialog = ({ 
  submissionId, 
  studentName,
  onGradingComplete 
}: FRQGradingDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frqAnswers, setFrqAnswers] = useState<StudentAnswer[]>([]);
  const [gradingState, setGradingState] = useState<{
    [answerId: string]: {
      isCorrect: boolean | null;
      feedback: string;
    };
  }>({});

  useEffect(() => {
    if (open) {
      fetchFRQAnswers();
    }
  }, [open, submissionId]);

  const fetchFRQAnswers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_answers")
        .select(`
          id,
          question_id,
          selected_answer,
          text_answer,
          is_correct,
          feedback,
          graded_at,
          question:questions!question_id(
            id,
            text,
            question_type,
            model_answer,
            order_number
          )
        `)
        .eq("submission_id", submissionId);

      if (error) throw error;

      // Filter for FRQ answers only
      const frqOnly = (data || [])
        .filter((a: any) => a.question?.question_type === 'free_response')
        .sort((a: any, b: any) => a.question.order_number - b.question.order_number);

      setFrqAnswers(frqOnly as StudentAnswer[]);

      // Initialize grading state
      const initialState: typeof gradingState = {};
      frqOnly.forEach((answer: any) => {
        initialState[answer.id] = {
          isCorrect: answer.is_correct,
          feedback: answer.feedback || "",
        };
      });
      setGradingState(initialState);
    } catch (error: any) {
      toast.error("답변을 불러오는데 실패했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (answerId: string, isCorrect: boolean | null) => {
    setGradingState(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        isCorrect,
      },
    }));
  };

  const handleFeedbackChange = (answerId: string, feedback: string) => {
    setGradingState(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        feedback,
      },
    }));
  };

  const handleSaveGrading = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Update each FRQ answer
      for (const answer of frqAnswers) {
        const grading = gradingState[answer.id];
        if (grading.isCorrect !== null) {
          const { error } = await supabase
            .from("student_answers")
            .update({
              is_correct: grading.isCorrect,
              feedback: grading.feedback || null,
              graded_by: user.id,
              graded_at: new Date().toISOString(),
            })
            .eq("id", answer.id);

          if (error) throw error;
        }
      }

      // Recalculate submission score
      await recalculateSubmissionScore();

      toast.success("채점이 저장되었습니다");
      setOpen(false);
      onGradingComplete?.();
    } catch (error: any) {
      toast.error("채점 저장에 실패했습니다: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const recalculateSubmissionScore = async () => {
    try {
      // Fetch all answers for this submission
      const { data: allAnswers, error: answersError } = await supabase
        .from("student_answers")
        .select("is_correct")
        .eq("submission_id", submissionId);

      if (answersError) throw answersError;

      // Count correct answers (including both MCQ and graded FRQ)
      const correctCount = (allAnswers || []).filter(a => a.is_correct === true).length;

      // Update submission score
      const { error: updateError } = await supabase
        .from("submissions")
        .update({ score: correctCount })
        .eq("id", submissionId);

      if (updateError) throw updateError;
    } catch (error: any) {
      console.error("Score recalculation failed:", error);
    }
  };

  const ungradedCount = frqAnswers.filter(a => gradingState[a.id]?.isCorrect === null).length;
  const allGraded = ungradedCount === 0 && frqAnswers.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PenLine className="h-4 w-4 mr-1" />
          채점
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            서술형 문제 채점
          </DialogTitle>
          <DialogDescription>
            {studentName}님의 서술형 답변을 채점하세요
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : frqAnswers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            이 제출에는 서술형 문제가 없습니다
          </p>
        ) : (
          <div className="space-y-6">
            {frqAnswers.map((answer, index) => (
              <Card key={answer.id} className={cn(
                "border-2 transition-colors",
                gradingState[answer.id]?.isCorrect === true && "border-green-500/50 bg-green-500/5",
                gradingState[answer.id]?.isCorrect === false && "border-red-500/50 bg-red-500/5",
                gradingState[answer.id]?.isCorrect === null && "border-purple-500/50 bg-purple-500/5"
              )}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">문제 {answer.question.order_number + 1}</Badge>
                      <span>{answer.question.text}</span>
                    </div>
                    {gradingState[answer.id]?.isCorrect !== null && (
                      <Badge variant={gradingState[answer.id]?.isCorrect ? "default" : "destructive"}>
                        {gradingState[answer.id]?.isCorrect ? "정답" : "오답"}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Student's Answer */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">학생 답변</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {answer.text_answer ? (
                        <MathDisplay latex={answer.text_answer} />
                      ) : (
                        <span className="text-muted-foreground italic">답변 없음</span>
                      )}
                    </div>
                  </div>

                  {/* Model Answer */}
                  {answer.question.model_answer && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">모범답안</Label>
                      <div className="p-3 bg-green-100 dark:bg-green-950 rounded-md">
                        <MathDisplay latex={answer.question.model_answer} />
                      </div>
                    </div>
                  )}

                  {/* Grading Buttons */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">채점</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={gradingState[answer.id]?.isCorrect === true ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleGradeChange(answer.id, true)}
                        className={cn(
                          gradingState[answer.id]?.isCorrect === true && "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        정답
                      </Button>
                      <Button
                        type="button"
                        variant={gradingState[answer.id]?.isCorrect === false ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleGradeChange(answer.id, false)}
                        className={cn(
                          gradingState[answer.id]?.isCorrect === false && "bg-red-600 hover:bg-red-700"
                        )}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        오답
                      </Button>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">피드백 (선택사항)</Label>
                    <Textarea
                      placeholder="학생에게 제공할 피드백을 입력하세요..."
                      value={gradingState[answer.id]?.feedback || ""}
                      onChange={(e) => handleFeedbackChange(answer.id, e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Summary and Save */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {allGraded ? (
                  <span className="text-green-600 font-medium">✓ 모든 서술형 문제가 채점되었습니다</span>
                ) : (
                  <span>미채점 문제: {ungradedCount}개</span>
                )}
              </div>
              <Button onClick={handleSaveGrading} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                채점 저장
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
