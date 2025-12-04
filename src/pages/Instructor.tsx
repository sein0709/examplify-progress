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
import { ArrowLeft, Plus, Trash2, CalendarIcon, Loader2, Upload, FileText, Image, Info, Users, TrendingUp, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BulkQuestionInput } from "@/components/BulkQuestionInput";
import { StudentAssignmentManager } from "@/components/StudentAssignmentManager";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
interface QuestionForm {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  questions: { count: number }[];
  submissions: { count: number }[];
}

interface Submission {
  id: string;
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
    };
  };
  averageScore: number;
  completedCount: number;
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
    { text: "", options: ["1", "2", "3", "4", "5"], correctAnswer: 0, explanation: "" },
  ]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentSubmissions, setSelectedAssignmentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

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
      setMyAssignments(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch assignments: " + error.message);
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
      toast.error("Failed to fetch submissions: " + error.message);
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
      
      // Build student progress map
      const progressMap = new Map<string, StudentProgress>();
      
      studentAssignmentsData?.forEach(sa => {
        const profile = profilesData?.find(p => p.id === sa.student_id);
        if (!profile) return;
        
        if (!progressMap.has(sa.student_id)) {
          progressMap.set(sa.student_id, {
            studentId: sa.student_id,
            studentName: profile.full_name || "Unknown",
            studentEmail: profile.email || "",
            assignments: {},
            averageScore: 0,
            completedCount: 0,
          });
        }
        
        const studentProgress = progressMap.get(sa.student_id)!;
        const submission = submissionsData?.find(
          s => s.student_id === sa.student_id && s.assignment_id === sa.assignment_id
        );
        
        studentProgress.assignments[sa.assignment_id] = {
          score: submission?.score ?? null,
          totalQuestions: submission?.total_questions ?? 0,
          submitted: !!submission,
        };
      });
      
      // Calculate averages
      progressMap.forEach(sp => {
        const scores: number[] = [];
        let completed = 0;
        Object.values(sp.assignments).forEach(a => {
          if (a.submitted && a.score !== null) {
            scores.push((a.score / a.totalQuestions) * 100);
            completed++;
          }
        });
        sp.averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        sp.completedCount = completed;
      });
      
      setStudentProgress(Array.from(progressMap.values()));
    } catch (error: any) {
      toast.error("Failed to fetch student progress: " + error.message);
    } finally {
      setProgressLoading(false);
    }
  };

    setQuestions([...questions, { text: "", options: ["1", "2", "3", "4", "5"], correctAnswer: 0, explanation: "" }]);
  };

  const addBulkQuestions = (bulkQuestions: QuestionForm[]) => {
    setQuestions([...questions, ...bulkQuestions]);
    toast.success(`Added ${bulkQuestions.length} questions`);
  };

  const handleFileUpload = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Validate file size (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size exceeds 10MB limit");
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
        toast.error("Invalid file type. Allowed: PDF, Word, PowerPoint, Images");
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
      toast.error("Failed to upload file: " + error.message);
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
      toast.error("Please enter an assignment title");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        toast.error(`Question ${i + 1} text is required`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!questions[i].options[j].trim()) {
          toast.error(`Question ${i + 1}, Option ${j + 1} is required`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
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
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      const questionsToInsert = questions.map((q, index) => ({
        assignment_id: assignment.id,
        text: q.text,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation || null,
        order_number: index,
      }));

      const { error: questionsError } = await supabase
        .from("questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast.success("Assignment created successfully!");
      setAssignmentTitle("");
      setDescription("");
      setDueDate(undefined);
      setIsResubmittable(false);
      setMaxAttempts(1);
      setUploadedFile(null);
      setQuestions([{ text: "", options: ["1", "2", "3", "4", "5"], correctAnswer: 0, explanation: "" }]);
      fetchMyAssignments();
    } catch (error: any) {
      toast.error("Failed to create assignment: " + error.message);
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

      toast.success("Assignment deleted successfully");
      fetchMyAssignments();
    } catch (error: any) {
      toast.error("Failed to delete assignment: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Instructor Portal</h1>
        </div>

        <Tabs defaultValue="create" className="space-y-4">
          <TabsList>
            <TabsTrigger value="create">Create Assignment</TabsTrigger>
            <TabsTrigger value="assignments">My Assignments</TabsTrigger>
            <TabsTrigger value="progress">Student Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - Assignment Details */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Assignment Details</CardTitle>
                    <CardDescription>Set up basic information for your assignment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="title">Assignment Title</Label>
                      <Input
                        id="title"
                        placeholder="Enter assignment title"
                        value={assignmentTitle}
                        onChange={(e) => setAssignmentTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        placeholder="Enter assignment description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Due Date (Optional)</Label>
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
                            {dueDate ? format(dueDate, "PPP") : "Pick a date"}
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
                      <Label htmlFor="file">Upload File (Optional)</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,.pdf"
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
                        Upload an image or PDF file to attach to this assignment
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
                          Allow students to resubmit this assignment
                        </Label>
                      </div>
                      
                      {isResubmittable && (
                        <div className="space-y-2 pl-6">
                          <Label htmlFor="maxAttempts">Maximum number of attempts</Label>
                          <Input
                            id="maxAttempts"
                            type="number"
                            min="1"
                            value={maxAttempts}
                            onChange={(e) => setMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                            placeholder="Enter number of attempts"
                          />
                          <p className="text-xs text-muted-foreground">
                            Students can submit this assignment up to {maxAttempts} time{maxAttempts !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Assignment"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Questions */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Questions</CardTitle>
                    <CardDescription>Add and configure questions for your assignment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      {questions.map((question, qIndex) => (
                        <Card 
                          key={qIndex} 
                          className="aspect-square flex flex-col border-2 hover:border-accent transition-colors cursor-pointer"
                          onClick={() => {
                            const element = document.getElementById(`question-form-${qIndex}`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          <CardHeader className="flex-1 flex items-center justify-center p-4">
                            <CardTitle className="text-center text-sm">
                              Question {qIndex + 1}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            {question.text && (
                              <p className="text-xs text-muted-foreground text-center line-clamp-2">
                                {question.text}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-6">
                      {questions.map((question, qIndex) => (
                        <Card key={qIndex} id={`question-form-${qIndex}`} className="border-2">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle>Question {qIndex + 1}</CardTitle>
                              {questions.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeQuestion(qIndex)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>Question Text</Label>
                              <Input
                                placeholder="Enter question text"
                                value={question.text}
                                onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                              />
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <Label className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  Click the radio button to mark the correct answer
                                </Label>
                              </div>
                              <RadioGroup
                                value={question.correctAnswer.toString()}
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
                                        placeholder={`Option ${oIndex + 1}`}
                                        value={option}
                                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                      />
                                    </div>
                                    {question.correctAnswer === oIndex && (
                                      <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
                                        ✓ Correct
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </RadioGroup>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`explanation-${qIndex}`}>Explanation (Optional)</Label>
                              <Textarea
                                id={`explanation-${qIndex}`}
                                placeholder="Explain why this answer is correct..."
                                value={question.explanation}
                                onChange={(e) => updateQuestion(qIndex, "explanation", e.target.value)}
                                rows={3}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Button onClick={addQuestion} variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>

                    <BulkQuestionInput onAddQuestions={addBulkQuestions} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle>My Assignments</CardTitle>
                <CardDescription>View and manage your created assignments</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : myAssignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No assignments created yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>Submissions</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{assignment.title}</TableCell>
                          <TableCell>{assignment.questions[0]?.count || 0}</TableCell>
                          <TableCell>
                            <Button
                              variant="link"
                              onClick={() => fetchSubmissions(assignment.id)}
                            >
                              {assignment.submissions[0]?.count || 0}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {assignment.due_date
                              ? new Date(assignment.due_date).toLocaleDateString()
                              : "No due date"}
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
                                Delete
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
                    <h3 className="text-lg font-semibold mb-4">Submissions</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Percentage</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAssignmentSubmissions.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell>{submission.student.full_name}</TableCell>
                            <TableCell>
                              {submission.score !== null
                                ? `${submission.score}/${submission.total_questions}`
                                : "Pending"}
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
                    <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentProgress.length}</div>
                    <p className="text-xs text-muted-foreground">assigned students</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {studentProgress.length > 0
                        ? `${Math.round(studentProgress.reduce((acc, s) => acc + s.averageScore, 0) / studentProgress.length)}%`
                        : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground">across all students</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(() => {
                        const totalAssigned = studentProgress.reduce(
                          (acc, s) => acc + Object.keys(s.assignments).length,
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
                    <p className="text-xs text-muted-foreground">submissions received</p>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Student Progress Overview</CardTitle>
                  <CardDescription>View scores for all assigned students across your assignments</CardDescription>
                </CardHeader>
                <CardContent>
                  {progressLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : studentProgress.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No students assigned to your assignments yet
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background">Student</TableHead>
                            {myAssignments.map((assignment) => (
                              <TableHead key={assignment.id} className="text-center min-w-[100px]">
                                {assignment.title.length > 15
                                  ? assignment.title.substring(0, 15) + "..."
                                  : assignment.title}
                              </TableHead>
                            ))}
                            <TableHead className="text-center">Average</TableHead>
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
                                        Not Assigned
                                      </Badge>
                                    </TableCell>
                                  );
                                }
                                if (!assignmentData.submitted) {
                                  return (
                                    <TableCell key={assignment.id} className="text-center">
                                      <Badge variant="secondary">Pending</Badge>
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
                  <CardHeader>
                    <CardTitle>Student Average Scores</CardTitle>
                    <CardDescription>Visual comparison of student performance</CardDescription>
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
                            formatter={(value: number) => [`${value}%`, "Average Score"]}
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
