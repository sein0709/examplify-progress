import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentScoreDialog } from "./StudentScoreDialog";

interface StudentGradeCardProps {
  studentId: string;
  studentName: string;
  index?: number;
}

interface QuickStats {
  averageScore: number;
  submissionCount: number;
  trend: "up" | "down" | "stable";
  lastScore: number | null;
}

export const StudentGradeCard = ({ studentId, studentName, index = 0 }: StudentGradeCardProps) => {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuickStats();
  }, [studentId]);

  const fetchQuickStats = async () => {
    try {
      const { data: submissions, error } = await supabase
        .from("submissions")
        .select("score, total_questions, submitted_at")
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const gradedSubmissions = submissions?.filter(s => s.score !== null) || [];
      const scores = gradedSubmissions.map(s => 
        Math.round((s.score! / s.total_questions) * 100)
      );

      const averageScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
        : 0;

      // Calculate trend (compare recent 3 vs older 3)
      let trend: "up" | "down" | "stable" = "stable";
      if (scores.length >= 4) {
        const recent = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const older = scores.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, scores.length - 3);
        if (recent > older + 5) trend = "up";
        else if (recent < older - 5) trend = "down";
      }

      setStats({
        averageScore,
        submissionCount: submissions?.length || 0,
        trend,
        lastScore: scores[0] || null
      });
    } catch (error) {
      console.error("Failed to fetch student stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  // Get avatar gradient based on name hash
  const getAvatarGradient = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      "from-violet-500 to-purple-600",
      "from-blue-500 to-cyan-600",
      "from-emerald-500 to-teal-600",
      "from-orange-500 to-amber-600",
      "from-pink-500 to-rose-600",
      "from-indigo-500 to-blue-600",
    ];
    return gradients[hash % gradients.length];
  };

  const TrendIcon = stats?.trend === "up" ? TrendingUp : stats?.trend === "down" ? TrendingDown : Minus;
  const trendColor = stats?.trend === "up" ? "text-emerald-500" : stats?.trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <StudentScoreDialog
      studentId={studentId}
      studentName={studentName}
      trigger={
        <Card 
          className={cn(
            "group relative overflow-hidden cursor-pointer",
            "border border-border/50 hover:border-primary/30",
            "bg-gradient-to-br from-card to-card/80",
            "hover:shadow-lg hover:shadow-primary/5",
            "transition-all duration-300 ease-out",
            "hover:-translate-y-1",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Subtle gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-accent/5 transition-all duration-300" />
          
          <div className="relative p-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className={cn(
                "relative flex-shrink-0 w-12 h-12 rounded-full",
                "bg-gradient-to-br",
                getAvatarGradient(studentName),
                "flex items-center justify-center",
                "text-white font-semibold text-sm",
                "shadow-md group-hover:shadow-lg",
                "transition-all duration-300",
                "group-hover:scale-105"
              )}>
                {getInitials(studentName)}
                {/* Online indicator style dot */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-card flex items-center justify-center">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    stats?.submissionCount && stats.submissionCount > 0 
                      ? "bg-emerald-500" 
                      : "bg-muted-foreground/30"
                  )} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">
                  {studentName}
                </h3>
                
                {loading ? (
                  <div className="h-4 w-24 bg-muted animate-pulse rounded mt-1" />
                ) : stats ? (
                  <div className="flex items-center gap-2 mt-1">
                    {stats.submissionCount > 0 ? (
                      <>
                        <span className={cn("text-lg font-bold", getScoreColor(stats.averageScore))}>
                          {stats.averageScore}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          평균
                        </span>
                        <TrendIcon className={cn("h-3 w-3 ml-1", trendColor)} />
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        제출 없음
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Stats & Arrow */}
              <div className="flex items-center gap-3">
                {!loading && stats && stats.submissionCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="hidden sm:flex bg-muted/50 text-muted-foreground font-normal"
                  >
                    {stats.submissionCount}개 제출
                  </Badge>
                )}
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </div>
          </div>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-300" />
        </Card>
      }
    />
  );
};
