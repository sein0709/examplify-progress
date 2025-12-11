import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, Search, Loader2 } from "lucide-react";

interface CompletionStatusItem {
  studentId: string;
  studentName: string;
  studentEmail: string;
  completed_at: string | null;
  notes: string | null;
}

interface CompletionStatusDialogProps {
  assignmentId: string;
  assignmentTitle: string;
}

export function CompletionStatusDialog({ assignmentId, assignmentTitle }: CompletionStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [completionData, setCompletionData] = useState<CompletionStatusItem[]>([]);

  const fetchCompletionStatus = async () => {
    setLoading(true);
    try {
      // Fetch assigned students for this assignment
      const { data: studentAssignments, error: saError } = await supabase
        .from("student_assignments")
        .select("student_id")
        .eq("assignment_id", assignmentId);

      if (saError) throw saError;

      const studentIds = studentAssignments?.map(sa => sa.student_id) || [];
      
      if (studentIds.length === 0) {
        setCompletionData([]);
        return;
      }

      // Fetch student profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);

      if (profilesError) throw profilesError;

      // Fetch completion status
      const { data: completions, error: compError } = await supabase
        .from("assignment_completions")
        .select("student_id, completed_at, notes")
        .eq("assignment_id", assignmentId);

      if (compError) throw compError;

      // Build completion data
      const data: CompletionStatusItem[] = (profiles || []).map(profile => {
        const completion = completions?.find(c => c.student_id === profile.id);
        return {
          studentId: profile.id,
          studentName: profile.full_name || "알 수 없음",
          studentEmail: profile.email || "",
          completed_at: completion?.completed_at || null,
          notes: completion?.notes || null,
        };
      });

      setCompletionData(data);
    } catch (error: any) {
      toast.error("완료 현황을 불러오는데 실패했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCompletionStatus();
      setSearchQuery("");
    }
  }, [open, assignmentId]);

  const filteredData = completionData.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      item.studentName.toLowerCase().includes(query) ||
      item.studentEmail.toLowerCase().includes(query)
    );
  });

  const completedCount = completionData.filter(d => d.completed_at).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-primary-foreground bg-primary border-accent">
          완료 현황 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{assignmentTitle} - 완료 현황</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="학생 이름 또는 이메일로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">
            {completedCount}/{completionData.length} 완료
          </Badge>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? "검색 결과가 없습니다" : "할당된 학생이 없습니다"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학생</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>완료일</TableHead>
                  <TableHead>메모</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.studentId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.studentName}</div>
                        <div className="text-xs text-muted-foreground">{item.studentEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.completed_at ? (
                        <Badge className="bg-green-500">
                          <Check className="h-3 w-3 mr-1" />완료
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <X className="h-3 w-3 mr-1" />미완료
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.completed_at
                        ? new Date(item.completed_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {item.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
