import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";

interface Student {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface StudentSelectorProps {
  selectedStudentIds: string[];
  onSelectionChange: (studentIds: string[]) => void;
}

export function StudentSelector({ selectedStudentIds, onSelectionChange }: StudentSelectorProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Get all student role user IDs
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      if (rolesError) throw rolesError;

      const studentIds = roles?.map(r => r.user_id) || [];

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      // Get verified profiles for those students
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds)
        .eq("verified", true)
        .order("full_name");

      if (profilesError) throw profilesError;

      setStudents(profiles || []);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      onSelectionChange(selectedStudentIds.filter(id => id !== studentId));
    } else {
      onSelectionChange([...selectedStudentIds, studentId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(students.map(s => s.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  return (
    <Card className="h-fit">
      <CardHeader variant="accent">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              학생 할당
            </CardTitle>
            <CardDescription>이 과제에 접근할 수 있는 학생을 선택하세요</CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            {selectedStudentIds.length} / {students.length}명 선택됨
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            등록된 학생이 없습니다
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={selectAll}
                disabled={selectedStudentIds.length === students.length}
              >
                전체 선택
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={deselectAll}
                disabled={selectedStudentIds.length === 0}
              >
                전체 해제
              </Button>
            </div>

            <ScrollArea className="h-[200px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow 
                      key={student.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleStudent(student.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.full_name || "이름 없음"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.email || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
