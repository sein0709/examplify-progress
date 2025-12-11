import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Trash2, LogOut, Plus, CalendarIcon, BarChart3, Upload, FileText, Image, Info } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BulkQuestionInput } from "@/components/BulkQuestionInput";
import { StudentSelector } from "@/components/StudentSelector";
import { MathInput } from "@/components/MathInput";
import { MathDisplay } from "@/components/MathDisplay";
interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  verified: boolean;
  created_at: string;
}
interface UserWithEmail extends UserProfile {
  role: string;
}
interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  instructor: {
    full_name: string;
  };
  questions: {
    count: number;
  }[];
}
interface Submission {
  id: string;
  score: number | null;
  total_questions: number;
  submitted_at: string;
  student_id: string;
  student: {
    full_name: string;
  };
  assignment: {
    title: string;
    id: string;
  };
}
interface QuestionForm {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  questionType: "multiple_choice" | "free_response";
  modelAnswer: string;
}
interface Instructor {
  id: string;
  full_name: string;
}
const Admin = () => {
  const {
    hasRole,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<UserWithEmail[]>([]);
  const [students, setStudents] = useState<UserWithEmail[]>([]);
  const [instructors, setInstructors] = useState<UserWithEmail[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Assignment States
  const [instructorsList, setInstructorsList] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string>("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
const [questions, setQuestions] = useState<QuestionForm[]>([{
    text: "",
    options: ["", "", "", "", ""],
    correctAnswer: 0,
    explanation: "",
    questionType: "multiple_choice",
    modelAnswer: ""
  }]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isResubmittable, setIsResubmittable] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const fetchUsers = async () => {
    try {
      const {
        data: profiles,
        error: profilesError
      } = await supabase.from("profiles").select("*").order("created_at", {
        ascending: false
      });
      if (profilesError) throw profilesError;
      const {
        data: roles,
        error: rolesError
      } = await supabase.from("user_roles").select("*");
      if (rolesError) throw rolesError;
      const usersWithRoles = profiles.map(profile => {
        const userRole = roles.find(role => role.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || "No role assigned"
        };
      });
      setPendingUsers(usersWithRoles.filter(user => !user.verified));
      setStudents(usersWithRoles.filter(user => user.verified && user.role === "student"));
      setInstructors(usersWithRoles.filter(user => user.verified && user.role === "instructor"));
    } catch (error: any) {
      toast.error("사용자 조회 실패: " + error.message);
    }
  };
  const fetchAssignments = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("assignments").select(`
          *,
          instructor:profiles!instructor_id(full_name),
          questions(count)
        `).order("created_at", {
        ascending: false
      });
      if (error) throw error;
      setAssignments(data || []);
    } catch (error: any) {
      toast.error("과제 조회 실패: " + error.message);
    }
  };
  const fetchSubmissions = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("submissions").select(`
          *,
          student:profiles!student_id(full_name),
          assignment:assignments(title, id)
        `).order("submitted_at", {
        ascending: false
      });
      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      toast.error("제출 내역 조회 실패: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  const fetchInstructors = async () => {
    try {
      const {
        data: roles,
        error: rolesError
      } = await supabase.from("user_roles").select("user_id, role");
      if (rolesError) throw rolesError;

      // Include both instructors and admins in the list
      const instructorAndAdminIds = roles.filter(r => r.role === "instructor" || r.role === "admin").map(r => r.user_id);
      const {
        data: profiles,
        error: profilesError
      } = await supabase.from("profiles").select("id, full_name").in("id", instructorAndAdminIds).eq("verified", true);
      if (profilesError) throw profilesError;
      setInstructorsList(profiles || []);
    } catch (error: any) {
      toast.error("강사 조회 실패: " + error.message);
    }
  };
  useEffect(() => {
    if (!hasRole("admin")) {
      navigate("/");
    } else {
      fetchUsers();
      fetchAssignments();
      fetchSubmissions();
      fetchInstructors();
    }
  }, [hasRole, navigate]);
  const approveUser = async (userId: string) => {
    try {
      // Check if user has a role assigned
      const {
        data: userRole,
        error: roleCheckError
      } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (roleCheckError) throw roleCheckError;
      if (!userRole) {
        toast.error("이 사용자에게 역할이 할당되지 않았습니다. 역할을 먼저 할당해주세요.");
        return;
      }
      const {
        error
      } = await supabase.from("profiles").update({
        verified: true
      }).eq("id", userId);
      if (error) throw error;
      toast.success("사용자 승인 완료");
      fetchUsers();
    } catch (error: any) {
      toast.error("사용자 승인 실패: " + error.message);
    }
  };
  const assignRole = async (userId: string, role: "student" | "instructor") => {
    try {
      // Check if user already has a role
      const {
        data: existingRole
      } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (existingRole) {
        // Update existing role
        const {
          error
        } = await supabase.from("user_roles").update({
          role
        }).eq("user_id", userId);
        if (error) throw error;
      } else {
        // Insert new role
        const {
          error
        } = await supabase.from("user_roles").insert({
          user_id: userId,
          role
        });
        if (error) throw error;
      }
      toast.success("역할 할당 완료");
      fetchUsers();
    } catch (error: any) {
      toast.error("역할 할당 실패: " + error.message);
    }
  };
  const rejectUser = async (userId: string) => {
    try {
      // Delete user role first (if exists)
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // Delete profile
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      
      toast.success("사용자 거부 완료 - 대기 목록에서 삭제됨");
      fetchUsers();
    } catch (error: any) {
      toast.error("사용자 거부 실패: " + error.message);
    }
  };
  const revokeAccess = async (userId: string) => {
    try {
      const {
        error
      } = await supabase.from("profiles").update({
        verified: false
      }).eq("id", userId);
      if (error) throw error;
      toast.success("접근 권한 취소 완료");
      fetchUsers();
    } catch (error: any) {
      toast.error("접근 권한 취소 실패: " + error.message);
    }
  };
  const deleteUser = async (userId: string) => {
    try {
      const {
        error: roleError
      } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (roleError) throw roleError;
      const {
        error: profileError
      } = await supabase.from("profiles").delete().eq("id", userId);
      if (profileError) throw profileError;
      toast.success("사용자 삭제 완료");
      fetchUsers();
    } catch (error: any) {
      toast.error("사용자 삭제 실패: " + error.message);
    }
  };
  const deleteAssignment = async (assignmentId: string) => {
    try {
      const {
        error
      } = await supabase.from("assignments").delete().eq("id", assignmentId);
      if (error) throw error;
      toast.success("과제 삭제 완료");
      fetchAssignments();
    } catch (error: any) {
      toast.error("과제 삭제 실패: " + error.message);
    }
  };

  // Create Assignment Functions
  const getFileType = (mimeType: string): 'image' | 'pdf' | 'document' | 'presentation' | null => {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType === 'application/pdf') {
      return 'pdf';
    }
    if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'document';
    }
    if (mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return 'presentation';
    }
    return null;
  };
const addQuestion = () => {
    setQuestions([...questions, {
      text: "",
      options: ["", "", "", "", ""],
      correctAnswer: 0,
      explanation: "",
      questionType: "multiple_choice",
      modelAnswer: ""
    }]);
  };
  const handleFileUpload = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);

      // Validate file size (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        toast.error("파일 크기가 10MB를 초과합니다");
        return null;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("잘못된 파일 형식입니다. 허용: PDF, Word, PowerPoint, 이미지");
        return null;
      }
      const fileExt = file.name.split('.').pop();
      // Use crypto-secure random ID instead of Math.random()
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('assignment-files').upload(filePath, file);
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('assignment-files').getPublicUrl(filePath);
      return publicUrl;
    } catch (error: any) {
      toast.error("파일 업로드 실패: " + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };
  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };
  const updateQuestion = (index: number, field: keyof QuestionForm, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value
    };
    setQuestions(newQuestions);
  };
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };
  const handleCreateAssignment = async () => {
    if (!selectedInstructor) {
      toast.error("강사를 선택해주세요");
      return;
    }
    if (!assignmentTitle.trim()) {
      toast.error("과제 제목을 입력해주세요");
      return;
    }
for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        toast.error(`문제 ${i + 1}의 내용을 입력해주세요`);
        return;
      }
      if (questions[i].questionType === "multiple_choice") {
        for (let j = 0; j < 5; j++) {
          if (!questions[i].options[j].trim()) {
            toast.error(`문제 ${i + 1}, 선택지 ${j + 1}을 입력해주세요`);
            return;
          }
        }
      }
    }
    setSubmitting(true);
    try {
      // Upload file if present
      let fileUrl = null;
      let fileType = null;
      if (uploadedFile) {
        fileUrl = await handleFileUpload(uploadedFile);
        if (!fileUrl) {
          setSubmitting(false);
          return; // File upload failed, abort
        }
        fileType = getFileType(uploadedFile.type);
      }
      const {
        data: assignment,
        error: assignmentError
      } = await supabase.from("assignments").insert({
        title: assignmentTitle,
        description: description || null,
        instructor_id: selectedInstructor,
        due_date: dueDate?.toISOString() || null,
        file_url: fileUrl,
        file_type: fileType,
        is_resubmittable: isResubmittable,
        max_attempts: isResubmittable ? maxAttempts : null
      }).select().single();
      if (assignmentError) throw assignmentError;
const questionsToInsert = questions.map((q, index) => ({
        assignment_id: assignment.id,
        text: q.text,
        options: q.questionType === "multiple_choice" ? q.options : [],
        correct_answer: q.questionType === "multiple_choice" ? q.correctAnswer : null,
        explanation: q.explanation || null,
        order_number: index,
        question_type: q.questionType,
        model_answer: q.questionType === "free_response" ? q.modelAnswer || null : null
      }));
      const {
        error: questionsError
      } = await supabase.from("questions").insert(questionsToInsert);
      if (questionsError) throw questionsError;

      // Insert student assignments if any students selected
      if (selectedStudentIds.length > 0) {
        const studentAssignments = selectedStudentIds.map(studentId => ({
          assignment_id: assignment.id,
          student_id: studentId
        }));
        const {
          error: saError
        } = await supabase.from("student_assignments").insert(studentAssignments);
        if (saError) throw saError;
      }
      toast.success("과제 생성 완료!");
      setSelectedInstructor("");
      setAssignmentTitle("");
      setDescription("");
      setDueDate(undefined);
      setIsResubmittable(false);
      setMaxAttempts(1);
      setUploadedFile(null);
      setSelectedStudentIds([]);
setQuestions([{
        text: "",
        options: ["", "", "", "", ""],
        correctAnswer: 0,
        explanation: "",
        questionType: "multiple_choice",
        modelAnswer: ""
      }]);
      fetchAssignments();
    } catch (error: any) {
      toast.error("과제 생성 실패: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Analytics Functions
  const calculateOverallStats = () => {
    const completedSubmissions = submissions.filter(s => s.score !== null);
    const totalScore = completedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
    const totalPossible = completedSubmissions.reduce((sum, s) => sum + s.total_questions, 0);
    return {
      averageScore: totalPossible > 0 ? Math.round(totalScore / totalPossible * 100) : 0,
      totalSubmissions: submissions.length,
      completedSubmissions: completedSubmissions.length,
      completionRate: submissions.length > 0 ? Math.round(completedSubmissions.length / submissions.length * 100) : 0
    };
  };
  const getAssignmentStats = (assignmentId: string) => {
    const assignmentSubmissions = submissions.filter(s => s.assignment.id === assignmentId);
    const completedSubmissions = assignmentSubmissions.filter(s => s.score !== null);
    const scores = completedSubmissions.map(s => s.score !== null ? Math.round(s.score / s.total_questions * 100) : 0);
    const totalStudents = students.length;
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // Create histogram bins for score distribution
    const scoreDistribution: {
      [key: string]: number;
    } = {
      '0-9': 0,
      '10-19': 0,
      '20-29': 0,
      '30-39': 0,
      '40-49': 0,
      '50-59': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0
    };
    scores.forEach(score => {
      if (score < 10) scoreDistribution['0-9']++;else if (score < 20) scoreDistribution['10-19']++;else if (score < 30) scoreDistribution['20-29']++;else if (score < 40) scoreDistribution['30-39']++;else if (score < 50) scoreDistribution['40-49']++;else if (score < 60) scoreDistribution['50-59']++;else if (score < 70) scoreDistribution['60-69']++;else if (score < 80) scoreDistribution['70-79']++;else if (score < 90) scoreDistribution['80-89']++;else scoreDistribution['90-100']++;
    });
    const chartData = Object.entries(scoreDistribution).map(([range, count]) => ({
      range,
      count,
      percentage: completedSubmissions.length > 0 ? Math.round(count / completedSubmissions.length * 100) : 0
    }));
    const uniqueStudents = new Set(assignmentSubmissions.map(s => s.student_id)).size;
    return {
      totalSubmissions: assignmentSubmissions.length,
      completedSubmissions: completedSubmissions.length,
      completionRate: totalStudents > 0 ? Math.round(uniqueStudents / totalStudents * 100) : 0,
      averageScore,
      scoreDistribution: chartData
    };
  };
  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };
  return <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/instructor")}>
              강사 포털
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>

        {loading ? <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div> : <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">사용자 관리</TabsTrigger>
              <TabsTrigger value="create">과제 생성</TabsTrigger>
              <TabsTrigger value="assignments">과제 목록</TabsTrigger>
              <TabsTrigger value="grades">성적</TabsTrigger>
              <TabsTrigger value="analytics">분석</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader variant="accent">
                  <CardTitle>승인 대기</CardTitle>
                  <CardDescription>
                    신규 사용자 등록 검토 및 승인
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingUsers.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      승인 대기 중인 사용자가 없습니다
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>역할</TableHead>
                          <TableHead>등록일</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingUsers.map(user => <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name}
                            </TableCell>
                            <TableCell>{user.email || "N/A"}</TableCell>
                            <TableCell>
                              {user.role === "No role assigned" ? <div className="flex items-center gap-2">
                                  <span className="text-destructive font-semibold">{user.role}</span>
                                  <Select onValueChange={role => assignRole(user.id, role as "student" | "instructor")}>
                                    <SelectTrigger className="w-32">
                                      <SelectValue placeholder="역할 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="student">Student</SelectItem>
                                      <SelectItem value="instructor">Instructor</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div> : user.role}
                            </TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => approveUser(user.id)}>
                                  승인
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => rejectUser(user.id)}>
                                  거부
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader variant="accent">
                  <CardTitle>학생</CardTitle>
                  <CardDescription>
                    학생 계정 관리
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      등록된 학생이 없습니다
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>등록일</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map(user => <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name}
                            </TableCell>
                            <TableCell>{user.email || "N/A"}</TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => revokeAccess(user.id)}>
                                  접근 권한 취소
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteUser(user.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader variant="accent">
                  <CardTitle>강사</CardTitle>
                  <CardDescription>
                    강사 계정 관리
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {instructors.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      등록된 강사가 없습니다
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>등록일</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {instructors.map(user => <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name}
                            </TableCell>
                            <TableCell>{user.email || "N/A"}</TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => revokeAccess(user.id)}>
                                  접근 권한 취소
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteUser(user.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create">
              <div className="space-y-6">
                {/* Top Row - Assignment Details, Bulk Question Input, Student Selector */}
              <div className="grid md:grid-cols-3 gap-6 items-stretch">
                  {/* Column 1 - Assignment Details */}
                  <Card>
                    <CardHeader variant="accent">
                      <CardTitle>과제 생성</CardTitle>
                      <CardDescription>과제의 기본 정보를 설정하세요</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 mt-2.5">
                      <div className="space-y-2">
                        <Label>강사 선택</Label>
                        <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                          <SelectTrigger>
                            <SelectValue placeholder="강사를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {instructorsList.map(instructor => <SelectItem key={instructor.id} value={instructor.id}>
                                {instructor.full_name}
                              </SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="title">과제 제목</Label>
                        <Input id="title" placeholder="과제 제목을 입력하세요" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">설명 (선택사항)</Label>
                        <Input id="description" placeholder="과제 설명을 입력하세요" value={description} onChange={e => setDescription(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>마감일 (선택사항)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dueDate ? format(dueDate, "PPP") : "날짜 선택"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="file">파일 업로드 (선택사항)</Label>
                        <div className="flex gap-2 items-center">
                          <Input id="file" type="file" accept="image/*,.pdf" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadedFile(file);
                        }
                      }} disabled={uploading} />
                          {uploadedFile && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {uploadedFile.type.startsWith('image/') ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              <span>{uploadedFile.name}</span>
                            </div>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          이 과제에 첨부할 이미지 또는 PDF 파일을 업로드하세요
                        </p>
                      </div>

                      <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="resubmittable" checked={isResubmittable} onCheckedChange={checked => setIsResubmittable(checked as boolean)} />
                          <Label htmlFor="resubmittable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            학생들이 이 과제를 재제출할 수 있도록 허용
                          </Label>
                        </div>
                        
                        {isResubmittable && <div className="space-y-2 pl-6">
                            <Label htmlFor="maxAttempts">최대 시도 횟수</Label>
                            <Input id="maxAttempts" type="number" min="1" value={maxAttempts} onChange={e => setMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))} placeholder="시도 횟수를 입력하세요" />
                            <p className="text-xs text-muted-foreground">
                              학생들은 이 과제를 최대 {maxAttempts}회까지 제출할 수 있습니다
                            </p>
                          </div>}
                      </div>

                      <Button onClick={handleCreateAssignment} className="w-full" disabled={submitting}>
                        {submitting ? <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            생성 중...
                          </> : "과제 생성"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Column 2 - Bulk Question Input */}
                  <div className="h-fit">
                    <BulkQuestionInput onAddQuestions={newQuestions => {
                  setQuestions(prev => {
                    const hasContent = prev.length > 0 && (prev[0].text || prev[0].options.some(o => o));
                    if (hasContent) {
                      return [...prev, ...newQuestions];
                    }
                    return newQuestions;
                  });
                }} />
                  </div>

                  {/* Column 3 - Student Selector */}
                  <StudentSelector selectedStudentIds={selectedStudentIds} onSelectionChange={setSelectedStudentIds} />
                </div>

                {/* Bottom - Questions */}
                <Card>
                    <CardHeader variant="accent">
                      <CardTitle>문제</CardTitle>
                      <CardDescription>과제에 문제를 추가하고 설정하세요</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mt-2">
                        {questions.map((question, qIndex) => {
                    const hasContent = question.text || question.options.some(o => o);
                    return <div key={qIndex} onClick={() => {
                      const element = document.getElementById(`admin-question-form-${qIndex}`);
                      element?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                      });
                    }} className={cn("group relative aspect-square rounded-xl cursor-pointer", "border-2 transition-all duration-300 ease-out", "hover:scale-105 hover:shadow-lg hover:-translate-y-1", hasContent ? "bg-gradient-to-br from-accent/20 to-accent/5 border-accent/40 hover:border-accent hover:shadow-accent/20" : "bg-gradient-to-br from-muted/50 to-muted/20 border-border hover:border-accent/60")}>
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", "text-lg font-bold transition-colors duration-300", hasContent ? "bg-accent/30 text-accent-foreground group-hover:bg-accent/50" : "bg-muted text-muted-foreground group-hover:bg-accent/20")}>
                                  {qIndex + 1}
                                </div>
                                {question.text ? <p className="text-xs text-center text-muted-foreground line-clamp-2 px-1">
                                    {question.text}
                                  </p> : <p className="text-xs text-muted-foreground/60 italic">빈 문제</p>}
                              </div>
                              {hasContent && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                            </div>;
                  })}
                      </div>

                      <div className="space-y-6">
                        {questions.map((question, qIndex) => <Card key={qIndex} id={`admin-question-form-${qIndex}`} className="border-2 border-accent/30 hover:border-accent/50 transition-colors">
                            <CardHeader className="bg-gradient-to-r from-accent/10 to-transparent">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-lg shadow-sm">
                                    {qIndex + 1}
                                  </div>
                                  <CardTitle>문제 {qIndex + 1}</CardTitle>
                                </div>
                                {questions.length > 1 && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeQuestion(qIndex)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    삭제
                                  </Button>}
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <Label>문제 유형</Label>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant={question.questionType === "multiple_choice" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => updateQuestion(qIndex, "questionType", "multiple_choice")}
                                  >
                                    객관식
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={question.questionType === "free_response" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => updateQuestion(qIndex, "questionType", "free_response")}
                                  >
                                    서술형
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label>문제 텍스트</Label>
                                <Input placeholder="문제 텍스트를 입력하세요" value={question.text} onChange={e => updateQuestion(qIndex, "text", e.target.value)} />
                              </div>

                              {question.questionType === "multiple_choice" ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <Label className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                      라디오 버튼을 클릭하여 정답을 표시하세요
                                    </Label>
                                  </div>
                                  <RadioGroup value={question.correctAnswer.toString()} onValueChange={value => updateQuestion(qIndex, "correctAnswer", parseInt(value))}>
                                    {question.options.map((option, oIndex) => <div key={oIndex} className="flex items-center gap-2">
                                        <RadioGroupItem value={oIndex.toString()} id={`admin-q${qIndex}-o${oIndex}`} className="shrink-0" />
                                        <div className="flex-1">
                                          <Input placeholder={`선택지 ${oIndex + 1}`} value={option} onChange={e => updateOption(qIndex, oIndex, e.target.value)} />
                                        </div>
                                        {question.correctAnswer === oIndex && <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
                                            ✓ 정답
                                          </span>}
                                      </div>)}
                                  </RadioGroup>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md">
                                    <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                    <Label className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                      서술형 문제는 강사가 수동으로 채점해야 합니다
                                    </Label>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>모범 답안 (선택사항)</Label>
                                    <MathInput
                                      value={question.modelAnswer}
                                      onChange={(value) => updateQuestion(qIndex, "modelAnswer", value)}
                                      placeholder="채점 기준이 되는 모범 답안을 입력하세요..."
                                    />
                                    {question.modelAnswer && (
                                      <div className="p-3 bg-muted rounded-md">
                                        <Label className="text-xs text-muted-foreground mb-1 block">미리보기:</Label>
                                        <MathDisplay latex={question.modelAnswer} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                <Label htmlFor={`admin-explanation-${qIndex}`}>설명 (선택사항)</Label>
                                <Textarea id={`admin-explanation-${qIndex}`} placeholder="이 정답이 맞는 이유를 설명하세요..." value={question.explanation} onChange={e => updateQuestion(qIndex, "explanation", e.target.value)} rows={3} />
                              </div>
                            </CardContent>
                          </Card>)}
                      </div>

                      <Button onClick={addQuestion} variant="outline" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        문제 추가
                      </Button>
                    </CardContent>
                  </Card>
              </div>
            </TabsContent>

            <TabsContent value="assignments">
              <Card>
                <CardHeader variant="accent">
                  <CardTitle>전체 과제</CardTitle>
                  <CardDescription>
                    강사가 생성한 과제 보기 및 관리
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assignments.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      등록된 과제가 없습니다
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>제목</TableHead>
                          <TableHead>강사</TableHead>
                          <TableHead>질문 수</TableHead>
                          <TableHead>마감일</TableHead>
                          <TableHead>생성일</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map(assignment => <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {assignment.title}
                            </TableCell>
                            <TableCell>{assignment.instructor.full_name}</TableCell>
                            <TableCell>{assignment.questions[0]?.count || 0}</TableCell>
                            <TableCell>
                              {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : "마감일 없음"}
                            </TableCell>
                            <TableCell>
                              {new Date(assignment.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="destructive" onClick={() => deleteAssignment(assignment.id)}>
                                삭제
                              </Button>
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grades">
              <Card>
                <CardHeader variant="accent">
                  <CardTitle>전체 제출</CardTitle>
                  <CardDescription>
                    모든 과제에 대한 학생 제출 및 성적 보기
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submissions.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      제출 내역이 없습니다
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>학생</TableHead>
                          <TableHead>과제</TableHead>
                          <TableHead>점수</TableHead>
                          <TableHead>백분율</TableHead>
                          <TableHead>제출일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map(submission => <TableRow key={submission.id}>
                            <TableCell className="font-medium">
                              {submission.student.full_name}
                            </TableCell>
                            <TableCell>{submission.assignment.title}</TableCell>
                            <TableCell>
                              {submission.score !== null ? `${submission.score}/${submission.total_questions}` : "대기 중"}
                            </TableCell>
                            <TableCell>
                              {submission.score !== null ? `${Math.round(submission.score / submission.total_questions * 100)}%` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {new Date(submission.submitted_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-6">
                {/* Overall Statistics */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">평균 점수</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().averageScore}%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">전체 제출</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().totalSubmissions}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">완료</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().completedSubmissions}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">완료율</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().completionRate}%</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Per-Assignment Analytics */}
                <Card>
                  <CardHeader variant="accent">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      과제별 분석
                    </CardTitle>
                    <CardDescription>
                      각 과제에 대한 상세 점수 분석
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assignments.length === 0 ? <p className="text-center text-muted-foreground py-8">
                        등록된 과제가 없습니다
                      </p> : <div className="space-y-6">
                        {assignments.map(assignment => {
                    const stats = getAssignmentStats(assignment.id);
                    return <Card key={assignment.id} className="mt-2.5">
                              <CardHeader>
                                <CardTitle className="text-lg">{assignment.title}</CardTitle>
                                <CardDescription>
                                  작성자: {assignment.instructor.full_name}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                  <div>
                                    <p className="text-sm text-muted-foreground">평균 점수</p>
                                    <p className="text-2xl font-bold">{stats.averageScore}%</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">제출</p>
                                    <p className="text-2xl font-bold">
                                      {stats.completedSubmissions}/{stats.totalSubmissions}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">완료율</p>
                                    <p className="text-2xl font-bold">{stats.completionRate}%</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <h4 className="text-sm font-medium">점수 분포</h4>
                                  <ChartContainer config={{
                            count: {
                              label: "학생 수",
                              color: "hsl(var(--chart-1))"
                            }
                          }} className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={stats.scoreDistribution} className="h-80 max-h-80">
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="range" className="text-xs" label={{
                                  value: '점수 구간',
                                  position: 'insideBottom',
                                  offset: -5
                                }} />
                                        <YAxis className="text-xs" label={{
                                  value: '학생 수',
                                  angle: -90,
                                  position: 'insideLeft'
                                }} />
                                        <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => {
                                  const item = stats.scoreDistribution.find(d => d.count === value);
                                  return [`${value}명 (${item?.percentage || 0}%)`, "학생 수"];
                                }} />
                                        <Bar dataKey="count" fill="hsl(var(--data-viz))" radius={[4, 4, 0, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </ChartContainer>
                                </div>
                              </CardContent>
                            </Card>;
                  })}
                      </div>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>}
      </div>
    </div>;
};
export default Admin;