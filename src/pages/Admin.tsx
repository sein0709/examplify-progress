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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Create Assignment States
  const [instructorsList, setInstructorsList] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string>("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [questions, setQuestions] = useState<QuestionForm[]>([{
    text: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    explanation: ""
  }]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const rejectUser = async (userId: string) => {
    try {
      const {
        error
      } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      toast.success("사용자 거부 완료");
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
  const addQuestion = () => {
    setQuestions([...questions, {
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: ""
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
        toast.error(`질문 ${i + 1}의 내용을 입력해주세요`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!questions[i].options[j].trim()) {
          toast.error(`질문 ${i + 1}, 선택지 ${j + 1}을 입력해주세요`);
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const {
        data: assignment,
        error: assignmentError
      } = await supabase.from("assignments").insert({
        title: assignmentTitle,
        description: description || null,
        instructor_id: selectedInstructor,
        due_date: dueDate?.toISOString() || null
      }).select().single();
      if (assignmentError) throw assignmentError;
      const questionsToInsert = questions.map((q, index) => ({
        assignment_id: assignment.id,
        text: q.text,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation || null,
        order_number: index
      }));
      const {
        error: questionsError
      } = await supabase.from("questions").insert(questionsToInsert);
      if (questionsError) throw questionsError;
      toast.success("과제 생성 완료!");
      setSelectedInstructor("");
      setAssignmentTitle("");
      setDescription("");
      setDueDate(undefined);
      setUploadedFile(null);
      setQuestions([{
        text: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: ""
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
    const gradeDistribution = {
      A: scores.filter(s => s >= 90).length,
      B: scores.filter(s => s >= 80 && s < 90).length,
      C: scores.filter(s => s >= 70 && s < 80).length,
      D: scores.filter(s => s >= 60 && s < 70).length,
      F: scores.filter(s => s < 60).length
    };
    return {
      totalSubmissions: assignmentSubmissions.length,
      completedSubmissions: completedSubmissions.length,
      completionRate: totalStudents > 0 ? Math.round(assignmentSubmissions.length / totalStudents * 100) : 0,
      averageScore,
      gradeDistribution
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
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
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
                <CardHeader>
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
                            <TableCell>{user.role}</TableCell>
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
                <CardHeader>
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
                <CardHeader>
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
              <Card>
                <CardHeader>
                  <CardTitle>과제 생성</CardTitle>
                  <CardDescription>강사를 위한 새 과제 생성</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                    <Label htmlFor="description">설명 (선택)</Label>
                    <Input id="description" placeholder="과제 설명을 입력하세요" value={description} onChange={e => setDescription(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>마감일 (선택)</Label>
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
                  <Label htmlFor="file">파일 업로드 (선택)</Label>
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
                    이 과제에 첨부할 이미지나 PDF 파일을 업로드하세요
                  </p>
                </div>

                <div className="space-y-4">
                    <Label>질문</Label>
                    {/* Question Grid - 5 per row */}
                    <div className="grid grid-cols-5 gap-4">
                      {questions.map((question, qIndex) => (
                        <Card 
                          key={qIndex}
                          className={cn(
                            "aspect-square cursor-pointer hover:shadow-md transition-all relative",
                            expandedQuestion === qIndex && "ring-2 ring-primary shadow-lg"
                          )}
                          onClick={() => {
                            setExpandedQuestion(expandedQuestion === qIndex ? null : qIndex);
                          }}
                        >
                          {questions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (expandedQuestion === qIndex) {
                                  setExpandedQuestion(null);
                                }
                                removeQuestion(qIndex);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          <CardContent className="p-4 flex flex-col items-center justify-center h-full text-center">
                            <span className="font-semibold text-lg">질문 {qIndex + 1}</span>
                            {question.text && (
                              <span className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {question.text}
                              </span>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Add Question button */}
                      <Card 
                        className="aspect-square cursor-pointer border-dashed hover:border-solid hover:bg-accent/10 transition-all"
                        onClick={addQuestion}
                      >
                        <CardContent className="p-4 flex flex-col items-center justify-center h-full">
                          <Plus className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground mt-2">질문 추가</span>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Full Question Form - only show expanded question */}
                    {expandedQuestion !== null && questions[expandedQuestion] && (
                      <div className="mt-6">
                        <Card id={`question-form-${expandedQuestion}`} className="border rounded-lg">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">질문 {expandedQuestion + 1}</CardTitle>
                              {questions.length > 1 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    removeQuestion(expandedQuestion);
                                    setExpandedQuestion(null);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  질문 삭제
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>질문 내용</Label>
                              <Input 
                                placeholder="질문 내용을 입력하세요" 
                                value={questions[expandedQuestion].text} 
                                onChange={e => updateQuestion(expandedQuestion, "text", e.target.value)} 
                              />
                            </div>

                            <div className="space-y-3">
                              <RadioGroup 
                                value={questions[expandedQuestion].correctAnswer.toString()} 
                                onValueChange={value => updateQuestion(expandedQuestion, "correctAnswer", parseInt(value))}
                              >
                                {questions[expandedQuestion].options.map((option, oIndex) => (
                                  <div key={oIndex} className="flex items-center gap-2">
                                    <RadioGroupItem 
                                      value={oIndex.toString()} 
                                      id={`q${expandedQuestion}-o${oIndex}`} 
                                      className="shrink-0" 
                                    />
                                    <div className="flex-1">
                                      <Input 
                                        placeholder={`선택지 ${oIndex + 1}`} 
                                        value={option} 
                                        onChange={e => updateOption(expandedQuestion, oIndex, e.target.value)} 
                                      />
                                    </div>
                                    {questions[expandedQuestion].correctAnswer === oIndex && (
                                      <span className="text-xs font-medium shrink-0 text-[#a5d160]">
                                        ✓ 정답
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </RadioGroup>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`explanation-${expandedQuestion}`}>설명 (선택)</Label>
                              <Textarea 
                                id={`explanation-${expandedQuestion}`} 
                                placeholder="이 답이 정답인 이유를 설명하세요..." 
                                value={questions[expandedQuestion].explanation} 
                                onChange={e => updateQuestion(expandedQuestion, "explanation", e.target.value)} 
                                rows={3} 
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>

                  <Button onClick={handleCreateAssignment} className="w-full" disabled={submitting}>
                    {submitting ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        생성 중...
                      </> : "과제 생성"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments">
              <Card>
                <CardHeader>
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
                <CardHeader>
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
                  <CardHeader>
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
                    return <Card key={assignment.id}>
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

                                <div>
                                  <p className="text-sm font-medium mb-2">성적 분포</p>
                                  <div className="space-y-2">
                                    {Object.entries(stats.gradeDistribution).map(([grade, count]) => <div key={grade} className="flex items-center gap-2">
                                        <span className="text-sm font-medium w-8">{grade}:</span>
                                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                                          <div className={cn("h-full flex items-center justify-end px-2 text-xs font-medium text-white", grade === "A" && "bg-green-500", grade === "B" && "bg-blue-500", grade === "C" && "bg-yellow-500", grade === "D" && "bg-orange-500", grade === "F" && "bg-red-500")} style={{
                                  width: stats.completedSubmissions > 0 ? `${count / stats.completedSubmissions * 100}%` : "0%"
                                }}>
                                            {count > 0 && count}
                                          </div>
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12">
                                          {stats.completedSubmissions > 0 ? `${Math.round(count / stats.completedSubmissions * 100)}%` : "0%"}
                                        </span>
                                      </div>)}
                                  </div>
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