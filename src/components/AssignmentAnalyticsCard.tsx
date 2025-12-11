import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BookOpen, ClipboardList, CalendarIcon, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface AssignmentAnalyticsCardProps {
  assignment: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    created_at: string;
    assignment_type: string;
    instructor?: {
      full_name: string;
    };
  };
  showInstructor?: boolean;
  defaultExpanded?: boolean;
}

interface ScoreDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface AssignmentStats {
  totalSubmissions: number;
  completedSubmissions: number;
  completionRate: number;
  averageScore: number;
  scoreDistribution: ScoreDistribution[];
  totalAssigned: number;
}

export const AssignmentAnalyticsCard = ({
  assignment,
  showInstructor = false,
  defaultExpanded = false
}: AssignmentAnalyticsCardProps) => {
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  useEffect(() => {
    fetchStats();
  }, [assignment.id]);

  const fetchStats = async () => {
    try {
      // Fetch submissions for this assignment
      const { data: submissions, error: subError } = await supabase
        .from("submissions")
        .select("id, score, total_questions, student_id")
        .eq("assignment_id", assignment.id);

      if (subError) throw subError;

      // Fetch student assignments count
      const { data: studentAssignments, error: saError } = await supabase
        .from("student_assignments")
        .select("student_id")
        .eq("assignment_id", assignment.id);

      if (saError) throw saError;

      const completedSubmissions = submissions?.filter(s => s.score !== null) || [];
      const scores = completedSubmissions.map(s => 
        s.score !== null ? Math.round((s.score / s.total_questions) * 100) : 0
      );

      // Create histogram bins
      const scoreDistribution: { [key: string]: number } = {
        '0-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0,
        '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0
      };

      scores.forEach(score => {
        if (score < 10) scoreDistribution['0-9']++;
        else if (score < 20) scoreDistribution['10-19']++;
        else if (score < 30) scoreDistribution['20-29']++;
        else if (score < 40) scoreDistribution['30-39']++;
        else if (score < 50) scoreDistribution['40-49']++;
        else if (score < 60) scoreDistribution['50-59']++;
        else if (score < 70) scoreDistribution['60-69']++;
        else if (score < 80) scoreDistribution['70-79']++;
        else if (score < 90) scoreDistribution['80-89']++;
        else scoreDistribution['90-100']++;
      });

      const chartData = Object.entries(scoreDistribution).map(([range, count]) => ({
        range,
        count,
        percentage: completedSubmissions.length > 0 
          ? Math.round((count / completedSubmissions.length) * 100) 
          : 0
      }));

      const uniqueStudents = new Set(submissions?.map(s => s.student_id) || []).size;
      const totalAssigned = studentAssignments?.length || 0;

      setStats({
        totalSubmissions: submissions?.length || 0,
        completedSubmissions: completedSubmissions.length,
        completionRate: totalAssigned > 0 ? Math.round((uniqueStudents / totalAssigned) * 100) : 0,
        averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        scoreDistribution: chartData,
        totalAssigned
      });
    } catch (error) {
      console.error("Failed to fetch assignment stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = assignment.due_date 
    ? new Date(assignment.due_date) < new Date() 
    : false;
  const isNonQuiz = assignment.assignment_type === "reading";

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg">{assignment.title}</CardTitle>
                  <Badge variant={isNonQuiz ? "secondary" : "default"} className="text-xs">
                    {isNonQuiz ? (
                      <><BookOpen className="h-3 w-3 mr-1" />비퀴즈</>
                    ) : (
                      <><ClipboardList className="h-3 w-3 mr-1" />퀴즈</>
                    )}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      isCompleted 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300" 
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300"
                    )}
                  >
                    {isCompleted ? "완료" : "진행중"}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  {showInstructor && assignment.instructor && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {assignment.instructor.full_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {assignment.due_date 
                      ? new Date(assignment.due_date).toLocaleDateString() 
                      : "마감일 없음"}
                  </span>
                  {!loading && stats && !isNonQuiz && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      평균: {stats.averageScore}%
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {!loading && stats && (
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      제출: <span className="font-medium text-foreground">{stats.totalSubmissions}</span>
                      {stats.totalAssigned > 0 && ` / ${stats.totalAssigned}`}
                    </p>
                    <p className="text-muted-foreground">
                      완료율: <span className="font-medium text-foreground">{stats.completionRate}%</span>
                    </p>
                  </div>
                )}
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">로딩 중...</p>
            ) : stats ? (
              <div className="space-y-4">
                {/* Stats Summary */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{stats.averageScore}%</p>
                    <p className="text-xs text-muted-foreground">평균 점수</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
                    <p className="text-xs text-muted-foreground">총 제출</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{stats.totalAssigned}</p>
                    <p className="text-xs text-muted-foreground">할당된 학생</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{stats.completionRate}%</p>
                    <p className="text-xs text-muted-foreground">완료율</p>
                  </div>
                </div>

                {/* Score Distribution Chart - Only for quiz type */}
                {!isNonQuiz && stats.completedSubmissions > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">점수 분포</h4>
                    <ChartContainer 
                      config={{
                        count: { label: "학생 수", color: "hsl(var(--chart-1))" }
                      }} 
                      className="h-[200px] w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.scoreDistribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="range" 
                            className="text-xs"
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis className="text-xs" />
                          <ChartTooltip 
                            content={<ChartTooltipContent />}
                            formatter={(value: number) => {
                              const item = stats.scoreDistribution.find(d => d.count === value);
                              return [`${value}명 (${item?.percentage || 0}%)`, "학생 수"];
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="hsl(var(--data-viz))" 
                            radius={[4, 4, 0, 0]} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}

                {!isNonQuiz && stats.completedSubmissions === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    아직 채점된 제출이 없습니다
                  </p>
                )}

                {isNonQuiz && (
                  <p className="text-center text-muted-foreground py-4">
                    비퀴즈 과제는 점수 분포가 없습니다
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                통계를 불러올 수 없습니다
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
