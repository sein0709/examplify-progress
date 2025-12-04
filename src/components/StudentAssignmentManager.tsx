import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, UserPlus, UserMinus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Student {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface StudentAssignmentManagerProps {
  assignmentId: string;
  assignmentTitle: string;
}

export const StudentAssignmentManager = ({ assignmentId, assignmentTitle }: StudentAssignmentManagerProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Fetch all verified students
      const { data: studentsData, error: studentsError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, full_name, email, verified)
        `)
        .eq("role", "student");

      if (studentsError) throw studentsError;

      // Filter to only verified students
      const verifiedStudents = (studentsData || [])
        .filter((s: any) => s.profiles?.verified)
        .map((s: any) => ({
          id: s.user_id,
          full_name: s.profiles.full_name,
          email: s.profiles.email,
        }));

      setStudents(verifiedStudents);

      // Fetch assigned students for this assignment
      const { data: assignedData, error: assignedError } = await supabase
        .from("student_assignments")
        .select("student_id")
        .eq("assignment_id", assignmentId);

      if (assignedError) throw assignedError;

      setAssignedStudentIds(new Set((assignedData || []).map(a => a.student_id)));
    } catch (error: any) {
      toast.error("학생 목록을 불러오는데 실패했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStudents();
    }
  }, [open, assignmentId]);

  const toggleStudent = async (studentId: string) => {
    setSaving(true);
    try {
      if (assignedStudentIds.has(studentId)) {
        // Remove assignment
        const { error } = await supabase
          .from("student_assignments")
          .delete()
          .eq("assignment_id", assignmentId)
          .eq("student_id", studentId);

        if (error) throw error;

        setAssignedStudentIds(prev => {
          const next = new Set(prev);
          next.delete(studentId);
          return next;
        });
        toast.success("학생이 과제에서 제외되었습니다");
      } else {
        // Add assignment
        const { error } = await supabase
          .from("student_assignments")
          .insert({ assignment_id: assignmentId, student_id: studentId });

        if (error) throw error;

        setAssignedStudentIds(prev => new Set([...prev, studentId]));
        toast.success("학생이 과제에 할당되었습니다");
      }
    } catch (error: any) {
      toast.error("과제 할당 업데이트 실패: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const assignAll = async () => {
    setSaving(true);
    try {
      const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.id));
      if (unassignedStudents.length === 0) return;

      const { error } = await supabase
        .from("student_assignments")
        .insert(unassignedStudents.map(s => ({
          assignment_id: assignmentId,
          student_id: s.id,
        })));

      if (error) throw error;

      setAssignedStudentIds(new Set(students.map(s => s.id)));
      toast.success(`${unassignedStudents.length}명의 학생이 할당되었습니다`);
    } catch (error: any) {
      toast.error("학생 할당 실패: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeAll = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("student_assignments")
        .delete()
        .eq("assignment_id", assignmentId);

      if (error) throw error;

      setAssignedStudentIds(new Set());
      toast.success("모든 학생이 과제에서 제외되었습니다");
    } catch (error: any) {
      toast.error("학생 제외 실패: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          학생 할당
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>학생 과제 할당 관리</DialogTitle>
          <DialogDescription>
            "{assignmentTitle}" 과제에 접근할 수 있는 학생을 선택하세요
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="flex gap-2 items-center justify-between">
              <Badge variant="secondary">
                {students.length}명 중 {assignedStudentIds.size}명 할당됨
              </Badge>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={assignAll}
                  disabled={saving || assignedStudentIds.size === students.length}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  전체 할당
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={removeAll}
                  disabled={saving || assignedStudentIds.size === 0}
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  전체 제외
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              {students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  승인된 학생이 없습니다
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">할당</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>이메일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={assignedStudentIds.has(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell>{student.full_name || "알 수 없음"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {student.email || "이메일 없음"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
