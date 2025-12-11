import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { User, TrendingUp, Award, Target, Search, BookOpen, ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentScoreDialogProps {
  studentId: string;
  studentName: string;
  trigger?: React.ReactNode;
}

interface StudentSubmission {
  id: string;
  assignment_id: string;
  score: number | null;
  total_questions: number;
  submitted_at: string;
  assignment: {
    title: string;
    assignment_type: string;
    due_date: string | null;
  };
}

interface StudentCompletion {
  assignment_id: string;
  completed_at: string | null;
  assignment: {
    title: string;
    assignment_type: string;
  };
}

interface ScoreDistribution {
  range: string;
  count: number;
}

export const StudentScoreDialog = ({ studentId, studentName, trigger }: StudentScoreDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [completions, setCompletions] = useState<StudentCompletion[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      fetchStudentData();
    }
  }, [open, studentId]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // Fetch all submissions for this student
      const { data: submissionsData, error: subError } = await supabase
        .from("submissions")
        .select(`
          id,
          assignment_id,
          score,
          total_questions,
          submitted_at,
          assignment:assignments(title, assignment_type, due_date)
        `)
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false });

      if (subError) throw subError;
      setSubmissions(submissionsData || []);

      // Fetch completions for non-quiz assignments
      const { data: completionsData, error: compError } = await supabase
        .from("assignment_completions")
        .select(`
          assignment_id,
          completed_at,
          assignment:assignments(title, assignment_type)
        `)
        .eq("student_id", studentId);

      if (compError) throw compError;
      setCompletions(completionsData || []);
    } catch (error) {
      console.error("Failed to fetch student data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const gradedSubmissions = submissions.filter(s => s.score !== null);
  const scores = gradedSubmissions.map(s => 
    Math.round((s.score! / s.total_questions) * 100)
  );
  
  const averageScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
    : 0;
  
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // Score trend data (chronological order)
  const trendData = [...gradedSubmissions]
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    .map((s, index) => ({
      name: `${index + 1}`,
      score: Math.round((s.score! / s.total_questions) * 100),
      assignment: s.assignment.title
    }));

  // Score distribution
  const scoreDistribution: ScoreDistribution[] = [
    { range: '0-59', count: scores.filter(s => s < 60).length },
    { range: '60-69', count: scores.filter(s => s >= 60 && s < 70).length },
    { range: '70-79', count: scores.filter(s => s >= 70 && s < 80).length },
    { range: '80-89', count: scores.filter(s => s >= 80 && s < 90).length },
    { range: '90-100', count: scores.filter(s => s >= 90).length },
  ];

  // Filter submissions by search
  const filteredSubmissions = submissions.filter(s =>
    s.assignment.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (percentage >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-auto p-0 hover:underline font-medium">
            {studentName}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {studentName} - 성적 분석
          </DialogTitle>
          <DialogDescription>
            학생의 모든 과제 제출 기록 및 성적 분석
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    평균 점수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{averageScore}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    최고 점수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{highestScore}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    제출 수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{submissions.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    비퀴즈 완료
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{completions.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            {trendData.length > 1 && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Score Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">점수 추이</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis domain={[0, 100]} className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px"
                            }}
                            formatter={(value: number, name: string, props: any) => [
                              `${value}%`,
                              props.payload.assignment
                            ]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Score Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">점수 분포</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreDistribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="range" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px"
                            }}
                            formatter={(value: number) => [`${value}개`, "과제 수"]}
                          />
                          <Bar dataKey="count" fill="hsl(var(--data-viz))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Submissions Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">제출 기록</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="과제 검색..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredSubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {submissions.length === 0 ? "제출 기록이 없습니다" : "검색 결과가 없습니다"}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>과제</TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>점수</TableHead>
                        <TableHead>백분율</TableHead>
                        <TableHead>제출일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubmissions.map((submission) => {
                        const percentage = submission.score !== null 
                          ? Math.round((submission.score / submission.total_questions) * 100) 
                          : null;
                        return (
                          <TableRow key={submission.id}>
                            <TableCell className="font-medium">{submission.assignment.title}</TableCell>
                            <TableCell>
                              <Badge variant={submission.assignment.assignment_type === 'quiz' ? 'default' : 'secondary'}>
                                {submission.assignment.assignment_type === 'quiz' ? (
                                  <><ClipboardList className="h-3 w-3 mr-1" />퀴즈</>
                                ) : (
                                  <><BookOpen className="h-3 w-3 mr-1" />비퀴즈</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {submission.score !== null 
                                ? `${submission.score}/${submission.total_questions}` 
                                : "채점 대기"}
                            </TableCell>
                            <TableCell>
                              {percentage !== null ? (
                                <Badge className={getScoreColor(percentage)}>
                                  {percentage}%
                                </Badge>
                              ) : (
                                <Badge variant="outline">N/A</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(submission.submitted_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Non-Quiz Completions */}
            {completions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">비퀴즈 과제 완료 기록</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>과제</TableHead>
                        <TableHead>완료일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completions.map((completion, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{completion.assignment.title}</TableCell>
                          <TableCell>
                            {completion.completed_at 
                              ? new Date(completion.completed_at).toLocaleDateString() 
                              : "알 수 없음"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
