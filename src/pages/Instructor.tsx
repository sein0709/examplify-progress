import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Plus, Trash2, CalendarIcon, Loader2, Upload, FileText, Image, Info, Users, TrendingUp, CheckCircle, ClipboardList, BookOpen, Check, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BulkQuestionInput, ParsedQuestion } from "@/components/BulkQuestionInput";
import { StudentAssignmentManager } from "@/components/StudentAssignmentManager";
import { StudentSelector } from "@/components/StudentSelector";
import { MathInput } from "@/components/MathInput";
import { MathDisplay } from "@/components/MathDisplay";
import { FRQGradingDialog } from "@/components/FRQGradingDialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface QuestionForm {
  text: string;
  options: string[];
  correctAnswer: number | null;
  explanation: string;
  questionType: 'multiple_choice' | 'free_response';
  modelAnswer: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  assignment_type: 'quiz' | 'reading';
  questions: { count: number }[];
  submissions: { count: number }[];
}

interface Submission {
  id: string;
  assignment_id: string;
  score: number | null;
  total_questions: number;
  submitted_at: string;
  student: {
    full_name: string;
  };
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  studentEmail: string;
  assignments: {
    [assignmentId: string]: {
      score: number | null;
      totalQuestions: number;
      submitted: boolean;
      isNonQuiz: boolean;
      nonQuizCompleted: boolean;
    };
  };
  averageScore: number;
  completedCount: number;
  nonQuizCompletedCount: number;
  nonQuizTotalCount: number;
}

const Instructor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [isResubmittable, setIsResubmittable] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { text: "", options: ["1", "2", "3", "4", "5"], correctAnswer: 0, explanation: "", questionType: 'multiple_choice', modelAnswer: "" },
  ]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentSubmissions, setSelectedAssignmentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<'quiz' | 'reading'>('quiz');
  const [completionStatus, setCompletionStatus] = useState<{[studentId: string]: {completed_at: string | null, notes: string | null}}>({});

  useEffect(() => {
    fetchMyAssignments();
  }, [user]);

  useEffect(() => {
    if (myAssignments.length > 0) {
      fetchStudentProgress();
    }
  }, [myAssignments]);

  const fetchMyAssignments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          questions(count),
          submissions(count)
        `)
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMyAssignments((data || []).map(a => ({...a, assignment_type: a.assignment_type as 'quiz' | 'reading'})));
    } catch (error: any) {
      toast.error("과제 목록을 불러오는데 실패했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          student:profiles!student_id(full_name)
        `)
        .eq("assignment_id", assignmentId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setSelectedAssignmentSubmissions(data || []);
    } catch (error: any) {
      toast.error("제출 목록을 불러오는데 실패했습니다: " + error.message);
    }
  };

  const fetchStudentProgress = async () => {
    if (!user || myAssignments.length === 0) return;
    setProgressLoading(true);
    try {
      const assignmentIds = myAssignments.map(a => a.id);
      
      // Fetch all student assignments for instructor's assignments
      const { data: studentAssignmentsData, error: saError } = await supabase
        .from("student_assignments")
        .select("student_id, assignment_id")
        .in("assignment_id", assignmentIds);
      
      if (saError) throw saError;
      
      // Get unique student IDs
      const studentIds = [...new Set(studentAssignmentsData?.map(sa => sa.student_id) || [])];
      
      if (studentIds.length === 0) {
        setStudentProgress([]);
        return;
      }
      
      // Fetch student profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);
      
      if (profilesError) throw profilesError;
      
      // Fetch all submissions for these assignments
      const { data: submissionsData, error: subError } = await supabase
        .from("submissions")
        .select("student_id, assignment_id, score, total_questions")
        .in("assignment_id", assignmentIds);
      
      if (subError) throw subError;
      
      // Fetch all completions for non-quiz assignments
      const nonQuizAssignmentIds = myAssignments.filter(a => a.assignment_type === 'reading').map(a => a.id);
      const { data: completionsData, error: compError } = await supabase
        .from("assignment_completions")
        .select("student_id, assignment_id")
        .in("assignment_id", nonQuizAssignmentIds);
      
      if (compError) throw compError;
      
      // Build assignment type map
      const assignmentTypeMap = new Map<string, 'quiz' | 'reading'>();
      myAssignments.forEach(a => assignmentTypeMap.set(a.id, a.assignment_type));
      
      // Build student progress map
      const progressMap = new Map<string, StudentProgress>();
      
      studentAssignmentsData?.forEach(sa => {
        const profile = profilesData?.find(p => p.id === sa.student_id);
        if (!profile) return;
        
        if (!progressMap.has(sa.student_id)) {
          progressMap.set(sa.student_id, {
            studentId: sa.student_id,
            studentName: profile.full_name || "알 수 없음",
            studentEmail: profile.email || "",
            assignments: {},
            averageScore: 0,
            completedCount: 0,
            nonQuizCompletedCount: 0,
            nonQuizTotalCount: 0,
          });
        }
        
        const studentProgress = progressMap.get(sa.student_id)!;
        const isNonQuiz = assignmentTypeMap.get(sa.assignment_id) === 'reading';
        const submission = submissionsData?.find(
          s => s.student_id === sa.student_id && s.assignment_id === sa.assignment_id
        );
        const completion = completionsData?.find(
          c => c.student_id === sa.student_id && c.assignment_id === sa.assignment_id
        );
        
        studentProgress.assignments[sa.assignment_id] = {
          score: submission?.score ?? null,
          totalQuestions: submission?.total_questions ?? 0,
          submitted: !!submission,
          isNonQuiz,
          nonQuizCompleted: !!completion,
        };
      });
      
      // Calculate averages
      progressMap.forEach(sp => {
        const scores: number[] = [];
        let completed = 0;
        let nonQuizCompleted = 0;
        let nonQuizTotal = 0;
        Object.values(sp.assignments).forEach(a => {
          if (a.isNonQuiz) {
            nonQuizTotal++;
            if (a.nonQuizCompleted) nonQuizCompleted++;
          } else {
            if (a.submitted && a.score !== null) {
              scores.push((a.score / a.totalQuestions) * 100);
              completed++;
            }
          }
        });
        sp.averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        sp.completedCount = completed;
        sp.nonQuizCompletedCount = nonQuizCompleted;
        sp.nonQuizTotalCount = nonQuizTotal;
      });
      
      setStudentProgress(Array.from(progressMap.values()));
    } catch (error: any) {
      toast.error("학생 진도를 불러오는데 실패했습니다: " + error.message);
    } finally {
      setProgressLoading(false);
    }
  };

  const fetchCompletionStatus = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from("assignment_completions")
        .select("student_id, completed_at, notes")
        .eq("assignment_id", assignmentId);
      
      if (error) throw error;
      
      const statusMap: {[studentId: string]: {completed_at: string | null, notes: string | null}} = {};
      (data || []).forEach(c => {
        statusMap[c.student_id] = { completed_at: c.completed_at, notes: c.notes };
      });
      setCompletionStatus(statusMap);
    } catch (error: any) {
      toast.error("완료 현황을 불러오는데 실패했습니다: " + error.message);
    }
  };

  const addQuestion = (type: 'multiple_choice' | 'free_response' = 'multiple_choice') => {
    setQuestions([...questions, { 
      text: "", 
      options: ["1", "2", "3", "4", "5"], 
      correctAnswer: type === 'multiple_choice' ? 0 : null, 
      explanation: "", 
      questionType: type,
      modelAnswer: ""
    }]);
  };

  const addBulkQuestions = (bulkQuestions: ParsedQuestion[]) => {
    const newQuestions: QuestionForm[] = bulkQuestions.map(q => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      questionType: q.questionType,
      modelAnswer: q.modelAnswer,
    }));
    setQuestions([...questions, ...newQuestions]);
    toast.success(`${bulkQuestions.length}개 문제가 추가되었습니다`);
  };

  const handleFileUpload = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Validate file size (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        toast.error("파일 크기가 10MB 제한을 초과했습니다");
        return null;
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/gif'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error("올바르지 않은 파일 형식입니다. 허용: PDF, Word, PowerPoint, 이미지");
        return null;
      }

      const fileExt = file.name.split('.').pop();
      // Use crypto-secure random ID instead of Math.random()
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assignment-files')
        .getPublicUrl(filePath);

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
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = async () => {
    if (!assignmentTitle.trim()) {
      toast.error("과제 제목을 입력해주세요");
      return;
    }

    // Only validate questions for quiz type
    if (assignmentType === 'quiz') {
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].text.trim()) {
          toast.error(`문제 ${i + 1}의 텍스트가 필요합니다`);
          return;
        }
        if (questions[i].questionType === 'multiple_choice') {
          for (let j = 0; j < 4; j++) {
            if (!questions[i].options[j].trim()) {
              toast.error(`문제 ${i + 1}, 선택지 ${j + 1}이(가) 필요합니다`);
              return;
            }
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const getFileType = (mimeType: string): 'image' | 'pdf' | 'document' | 'presentation' | 'spreadsheet' | null => {
        if (mimeType.startsWith('image/')) {
          return 'image';
        }
        if (mimeType === 'application/pdf') {
          return 'pdf';
        }
        if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'text/plain') {
          return 'document';
        }
        if (mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
          return 'presentation';
        }
        if (mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          return 'spreadsheet';
        }
        return null;
      };

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

      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .insert({
          title: assignmentTitle,
          description: description || null,
          instructor_id: user?.id,
          due_date: dueDate?.toISOString() || null,
          file_url: fileUrl,
          file_type: fileType,
          is_resubmittable: isResubmittable,
          max_attempts: isResubmittable ? maxAttempts : null,
          assignment_type: assignmentType,
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      // Only create questions for quiz type
      if (assignmentType === 'quiz') {
        const questionsToInsert = questions.map((q, index) => ({
          assignment_id: assignment.id,
          text: q.text,
          options: q.options,
          correct_answer: q.questionType === 'multiple_choice' ? q.correctAnswer : null,
          explanation: q.explanation || null,
          order_number: index,
          question_type: q.questionType,
          model_answer: q.questionType === 'free_response' ? q.modelAnswer : null,
        }));

        const { error: questionsError } = await supabase
          .from("questions")
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      }

      // Insert student assignments if any students selected
      if (selectedStudentIds.length > 0) {
        const studentAssignments = selectedStudentIds.map(studentId => ({
          assignment_id: assignment.id,
          student_id: studentId,
        }));
        const { error: saError } = await supabase.from("student_assignments").insert(studentAssignments);
        if (saError) throw saError;
      }

      toast.success("과제가 성공적으로 생성되었습니다!");
      setAssignmentTitle("");
      setDescription("");
      setDueDate(undefined);
      setIsResubmittable(false);
      setMaxAttempts(1);
      setUploadedFile(null);
      setSelectedStudentIds([]);
      setAssignmentType('quiz');
      setQuestions([{ text: "", options: ["1", "2", "3", "4", "5"], correctAnswer: 0, explanation: "", questionType: 'multiple_choice', modelAnswer: "" }]);
      fetchMyAssignments();
    } catch (error: any) {
      toast.error("과제 생성 실패: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("과제가 성공적으로 삭제되었습니다");
      fetchMyAssignments();
    } catch (error: any) {
      toast.error("과제 삭제 실패: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">강사 포털</h1>
        </div>

        <Tabs defaultValue="create" className="space-y-4">
          <TabsList>
            <TabsTrigger value="create">과제 생성</TabsTrigger>
            <TabsTrigger value="assignments">내 과제</TabsTrigger>
            <TabsTrigger value="progress">학생 진도</TabsTrigger>
          </TabsList>

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
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>과제 유형</Label>
                      <RadioGroup
                        value={assignmentType}
                        onValueChange={(value) => setAssignmentType(value as 'quiz' | 'reading')}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="quiz" id="type-quiz" />
                          <Label htmlFor="type-quiz" className="flex items-center gap-1 cursor-pointer">
                            <ClipboardList className="h-4 w-4" />
                            퀴즈
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="reading" id="type-reading" />
                          <Label htmlFor="type-reading" className="flex items-center gap-1 cursor-pointer">
                            <BookOpen className="h-4 w-4" />
                            비퀴즈 과제
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title">과제 제목</Label>
                      <Input
                        id="title"
                        placeholder="과제 제목을 입력하세요"
                        value={assignmentTitle}
                        onChange={(e) => setAssignmentTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">설명 (선택사항)</Label>
                      <Input
                        id="description"
                        placeholder="과제 설명을 입력하세요"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>마감일 (선택사항)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dueDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, "PPP") : "날짜 선택"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dueDate}
                            onSelect={setDueDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="file">파일 업로드 (선택사항)</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadedFile(file);
                            }
                          }}
                          disabled={uploading}
                        />
                        {uploadedFile && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {uploadedFile.type.startsWith('image/') ? (
                              <Image className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            <span>{uploadedFile.name}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        이 과제에 첨부할 이미지 또는 PDF 파일을 업로드하세요
                      </p>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="resubmittable"
                          checked={isResubmittable}
                          onCheckedChange={(checked) => setIsResubmittable(checked as boolean)}
                        />
                        <Label htmlFor="resubmittable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          학생들이 이 과제를 재제출할 수 있도록 허용
                        </Label>
                      </div>
                      
                      {isResubmittable && (
                        <div className="space-y-2 pl-6">
                          <Label htmlFor="maxAttempts">최대 시도 횟수</Label>
                          <Input
                            id="maxAttempts"
                            type="number"
                            min="1"
                            value={maxAttempts}
                            onChange={(e) => setMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                            placeholder="시도 횟수를 입력하세요"
                          />
                          <p className="text-xs text-muted-foreground">
                            학생들은 이 과제를 최대 {maxAttempts}회까지 제출할 수 있습니다
                          </p>
                        </div>
                      )}
                    </div>

                    <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        "과제 생성"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Column 2 - Bulk Question Input (only for quiz) */}
                {assignmentType === 'quiz' && (
                  <div className="h-fit">
                    <BulkQuestionInput onAddQuestions={addBulkQuestions} />
                  </div>
                )}

                {/* Column 3 - Student Selector */}
                <StudentSelector
                  selectedStudentIds={selectedStudentIds}
                  onSelectionChange={setSelectedStudentIds}
                />
              </div>

              {/* Bottom - Questions (only for quiz type) */}
              {assignmentType === 'quiz' && (
              <Card>
                <CardHeader variant="accent">
                  <CardTitle>문제</CardTitle>
                  <CardDescription>과제에 문제를 추가하고 설정하세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mt-2">
                    {questions.map((question, qIndex) => {
                      const hasContent = question.text || question.options.some(o => o);
                      return (
                        <div
                          key={qIndex}
                          onClick={() => {
                            const element = document.getElementById(`question-form-${qIndex}`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={cn(
                            "group relative aspect-square rounded-xl cursor-pointer",
                            "border-2 transition-all duration-300 ease-out",
                            "hover:scale-105 hover:shadow-lg hover:-translate-y-1",
                            hasContent 
                              ? "bg-gradient-to-br from-accent/20 to-accent/5 border-accent/40 hover:border-accent hover:shadow-accent/20" 
                              : "bg-gradient-to-br from-muted/50 to-muted/20 border-border hover:border-accent/60"
                          )}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                              "text-lg font-bold transition-colors duration-300",
                              hasContent 
                                ? "bg-accent/30 text-accent-foreground group-hover:bg-accent/50" 
                                : "bg-muted text-muted-foreground group-hover:bg-accent/20"
                            )}>
                              {qIndex + 1}
                            </div>
                            {question.text ? (
                              <p className="text-xs text-center text-muted-foreground line-clamp-2 px-1">
                                {question.text}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 italic">빈 문제</p>
                            )}
                          </div>
                          {hasContent && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-6">
                    {questions.map((question, qIndex) => (
                      <Card key={qIndex} id={`question-form-${qIndex}`} className="border-2 border-accent/30 hover:border-accent/50 transition-colors">
                        <CardHeader className="bg-gradient-to-r from-accent/10 to-transparent">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-lg shadow-sm">
                                {qIndex + 1}
                              </div>
                              <CardTitle>문제 {qIndex + 1}</CardTitle>
                            </div>
                            {questions.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeQuestion(qIndex)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={question.questionType === 'multiple_choice' ? 'default' : 'secondary'}>
                              {question.questionType === 'multiple_choice' ? '객관식' : '서술형'}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <Label>문제 텍스트</Label>
                            <Input
                              placeholder="문제 텍스트를 입력하세요"
                              value={question.text}
                              onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                            />
                          </div>

                          {question.questionType === 'multiple_choice' ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <Label className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  라디오 버튼을 클릭하여 정답을 표시하세요
                                </Label>
                              </div>
                              <RadioGroup
                                value={(question.correctAnswer ?? 0).toString()}
                                onValueChange={(value) =>
                                  updateQuestion(qIndex, "correctAnswer", parseInt(value))
                                }
                              >
                                {question.options.map((option, oIndex) => (
                                  <div key={oIndex} className="flex items-center gap-2">
                                    <RadioGroupItem
                                      value={oIndex.toString()}
                                      id={`q${qIndex}-o${oIndex}`}
                                      className="shrink-0"
                                    />
                                    <div className="flex-1">
                                      <Input
                                        placeholder={`선택지 ${oIndex + 1}`}
                                        value={option}
                                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                      />
                                    </div>
                                    {question.correctAnswer === oIndex && (
                                      <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
                                        ✓ 정답
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </RadioGroup>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md">
                                <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                <Label className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                  모범답안을 입력하세요. 수학 기호를 사용할 수 있습니다.
                                </Label>
                              </div>
                              <Label>모범답안 (LaTeX 지원)</Label>
                              <MathInput
                                value={question.modelAnswer}
                                onChange={(value) => updateQuestion(qIndex, "modelAnswer", value)}
                                placeholder="모범답안을 입력하세요 (예: x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a})"
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor={`explanation-${qIndex}`}>설명 (선택사항)</Label>
                            <Textarea
                              id={`explanation-${qIndex}`}
                              placeholder="이 정답이 맞는 이유를 설명하세요..."
                              value={question.explanation}
                              onChange={(e) => updateQuestion(qIndex, "explanation", e.target.value)}
                              rows={3}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => addQuestion('multiple_choice')} variant="outline" className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      객관식 문제 추가
                    </Button>
                    <Button onClick={() => addQuestion('free_response')} variant="outline" className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      서술형 문제 추가
                    </Button>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assignments">
            <Card>
              <CardHeader variant="accent">
                <CardTitle>내 과제</CardTitle>
                <CardDescription>생성한 과제를 확인하고 관리하세요</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : myAssignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    아직 생성된 과제가 없습니다
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>제목</TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>문제/완료</TableHead>
                        <TableHead>마감일</TableHead>
                        <TableHead>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{assignment.title}</TableCell>
                          <TableCell>
                            <Badge variant={assignment.assignment_type === 'quiz' ? 'default' : 'secondary'}>
                              {assignment.assignment_type === 'quiz' ? (
                                <><ClipboardList className="h-3 w-3 mr-1" />퀴즈</>
                              ) : (
                                <><BookOpen className="h-3 w-3 mr-1" />비퀴즈</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.assignment_type === 'quiz' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                onClick={() => fetchSubmissions(assignment.id)}
                              >
                                {assignment.submissions[0]?.count || 0} 제출 ({assignment.questions[0]?.count || 0} 문제)
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                onClick={() => fetchCompletionStatus(assignment.id)}
                              >
                                완료 현황 보기
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            {assignment.due_date
                              ? new Date(assignment.due_date).toLocaleDateString()
                              : "마감일 없음"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <StudentAssignmentManager
                                assignmentId={assignment.id}
                                assignmentTitle={assignment.title}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteAssignment(assignment.id)}
                              >
                                삭제
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {selectedAssignmentSubmissions.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">제출 목록</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>학생</TableHead>
                          <TableHead>점수</TableHead>
                          <TableHead>백분율</TableHead>
                          <TableHead>제출일</TableHead>
                          <TableHead>채점</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAssignmentSubmissions.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell>{submission.student.full_name}</TableCell>
                            <TableCell>
                              {submission.score !== null
                                ? `${submission.score}/${submission.total_questions}`
                                : "대기중"}
                            </TableCell>
                            <TableCell>
                              {submission.score !== null
                                ? `${Math.round(
                                    (submission.score / submission.total_questions) * 100
                                  )}%`
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {new Date(submission.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <FRQGradingDialog
                                submissionId={submission.id}
                                studentName={submission.student.full_name}
                                onGradingComplete={() => fetchSubmissions(submission.assignment_id)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {Object.keys(completionStatus).length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">완료 현황</h3>
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
                        {Object.entries(completionStatus).map(([studentId, status]) => (
                          <TableRow key={studentId}>
                            <TableCell>{studentId}</TableCell>
                            <TableCell>
                              {status.completed_at ? (
                                <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />완료</Badge>
                              ) : (
                                <Badge variant="outline"><X className="h-3 w-3 mr-1" />미완료</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {status.completed_at ? new Date(status.completed_at).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {status.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress">
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">전체 학생</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentProgress.length}</div>
                    <p className="text-xs text-muted-foreground">할당된 학생</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">평균 점수</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {studentProgress.length > 0
                        ? `${Math.round(studentProgress.reduce((acc, s) => acc + s.averageScore, 0) / studentProgress.length)}%`
                        : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground">전체 학생 기준</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">퀴즈 완료율</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(() => {
                        const totalAssigned = studentProgress.reduce(
                          (acc, s) => acc + Object.values(s.assignments).filter(a => !a.isNonQuiz).length,
                          0
                        );
                        const totalCompleted = studentProgress.reduce(
                          (acc, s) => acc + s.completedCount,
                          0
                        );
                        return totalAssigned > 0
                          ? `${Math.round((totalCompleted / totalAssigned) * 100)}%`
                          : "N/A";
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">퀴즈 제출 완료</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">비퀴즈 완료율</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(() => {
                        const totalNonQuiz = studentProgress.reduce(
                          (acc, s) => acc + s.nonQuizTotalCount,
                          0
                        );
                        const completedNonQuiz = studentProgress.reduce(
                          (acc, s) => acc + s.nonQuizCompletedCount,
                          0
                        );
                        return totalNonQuiz > 0
                          ? `${Math.round((completedNonQuiz / totalNonQuiz) * 100)}%`
                          : "N/A";
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">비퀴즈 완료</p>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Table */}
              <Card>
                <CardHeader variant="accent">
                  <CardTitle>학생 진도 현황</CardTitle>
                  <CardDescription>모든 할당된 학생들의 과제별 점수를 확인하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  {progressLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : studentProgress.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      아직 과제에 할당된 학생이 없습니다
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background">학생</TableHead>
                            {myAssignments.map((assignment) => (
                              <TableHead key={assignment.id} className="text-center min-w-[100px]">
                                {assignment.title.length > 15
                                  ? assignment.title.substring(0, 15) + "..."
                                  : assignment.title}
                              </TableHead>
                            ))}
                            <TableHead className="text-center">평균</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentProgress.map((student) => (
                            <TableRow key={student.studentId}>
                              <TableCell className="sticky left-0 bg-background font-medium">
                                <div>
                                  <div>{student.studentName}</div>
                                  <div className="text-xs text-muted-foreground">{student.studentEmail}</div>
                                </div>
                              </TableCell>
                              {myAssignments.map((assignment) => {
                                const assignmentData = student.assignments[assignment.id];
                                if (!assignmentData) {
                                  return (
                                    <TableCell key={assignment.id} className="text-center">
                                      <Badge variant="outline" className="text-muted-foreground">
                                        미할당
                                      </Badge>
                                    </TableCell>
                                  );
                                }
                                // Non-quiz assignment - show completion status
                                if (assignmentData.isNonQuiz) {
                                  return (
                                    <TableCell key={assignment.id} className="text-center">
                                      {assignmentData.nonQuizCompleted ? (
                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                          <Check className="h-3 w-3 mr-1" />완료
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary">미완료</Badge>
                                      )}
                                    </TableCell>
                                  );
                                }
                                // Quiz assignment - show score
                                if (!assignmentData.submitted) {
                                  return (
                                    <TableCell key={assignment.id} className="text-center">
                                      <Badge variant="secondary">대기중</Badge>
                                    </TableCell>
                                  );
                                }
                                const percentage =
                                  assignmentData.score !== null
                                    ? Math.round((assignmentData.score / assignmentData.totalQuestions) * 100)
                                    : 0;
                                const colorClass =
                                  percentage >= 80
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : percentage >= 60
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
                                return (
                                  <TableCell key={assignment.id} className="text-center">
                                    <Badge className={colorClass}>{percentage}%</Badge>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center">
                                <Badge variant="default">
                                  {Math.round(student.averageScore)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bar Chart */}
              {studentProgress.length > 0 && (
              <Card>
                  <CardHeader variant="accent">
                    <CardTitle>학생별 평균 점수</CardTitle>
                    <CardDescription>학생 성과 시각적 비교</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={studentProgress.map((s) => ({
                            name: s.studentName.split(" ")[0],
                            score: Math.round(s.averageScore),
                          }))}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                          <YAxis domain={[0, 100]} className="text-xs fill-muted-foreground" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                            formatter={(value: number) => [`${value}%`, "평균 점수"]}
                          />
                          <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Instructor;
