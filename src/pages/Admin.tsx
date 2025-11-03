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
      toast.error("Failed to fetch users: " + error.message);
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
      toast.error("Failed to fetch assignments: " + error.message);
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
      toast.error("Failed to fetch submissions: " + error.message);
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
      toast.error("Failed to fetch instructors: " + error.message);
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
      toast.success("User approved successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to approve user: " + error.message);
    }
  };
  const rejectUser = async (userId: string) => {
    try {
      const {
        error
      } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      toast.success("User rejected successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to reject user: " + error.message);
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
      toast.success("Access revoked successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to revoke access: " + error.message);
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
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to delete user: " + error.message);
    }
  };
  const deleteAssignment = async (assignmentId: string) => {
    try {
      const {
        error
      } = await supabase.from("assignments").delete().eq("id", assignmentId);
      if (error) throw error;
      toast.success("Assignment deleted successfully");
      fetchAssignments();
    } catch (error: any) {
      toast.error("Failed to delete assignment: " + error.message);
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
        toast.error("File size exceeds 10MB limit");
        return null;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type. Allowed: PDF, Word, PowerPoint, Images");
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
      toast.error("Please select an instructor");
      return;
    }
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
      toast.success("Assignment created successfully!");
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
      toast.error("Failed to create assignment: " + error.message);
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
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {loading ? <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div> : <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="create">Create Assignment</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approval</CardTitle>
                  <CardDescription>
                    Review and approve new user registrations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingUsers.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      No pending users
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Actions</TableHead>
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
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => rejectUser(user.id)}>
                                  Reject
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
                  <CardTitle>Students</CardTitle>
                  <CardDescription>
                    Manage student accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      No students found
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Actions</TableHead>
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
                                  Revoke Access
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
                  <CardTitle>Instructors</CardTitle>
                  <CardDescription>
                    Manage instructor accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {instructors.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      No instructors found
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Actions</TableHead>
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
                                  Revoke Access
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
                  <CardTitle>Create Assignment</CardTitle>
                  <CardDescription>Create a new assignment for an instructor</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Select Instructor</Label>
                    <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an instructor" />
                      </SelectTrigger>
                      <SelectContent>
                        {instructorsList.map(instructor => <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.full_name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Assignment Title</Label>
                    <Input id="title" placeholder="Enter assignment title" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input id="description" placeholder="Enter assignment description" value={description} onChange={e => setDescription(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Due Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Upload File (Optional)</Label>
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
                    Upload an image or PDF file to attach to this assignment
                  </p>
                </div>

                <div className="space-y-4">
                    <Label>Questions</Label>
                    <Accordion type="single" collapsible className="w-full space-y-2">
                      {questions.map((question, qIndex) => <AccordionItem key={qIndex} value={`question-${qIndex}`} className="border rounded-lg">
                          <AccordionTrigger className="px-4 hover:no-underline hover:bg-accent rounded-t-lg">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-semibold">Question {qIndex + 1}</span>
                              {question.text && <span className="text-sm text-muted-foreground truncate ml-4 max-w-md">
                                  {question.text}
                                </span>}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4 pt-4">
                              {questions.length > 1 && <div className="flex justify-end">
                                  <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Question
                                  </Button>
                                </div>}
                              
                              <div className="space-y-2">
                                <Label>Question Text</Label>
                                <Input placeholder="Enter question text" value={question.text} onChange={e => updateQuestion(qIndex, "text", e.target.value)} />
                              </div>

                              <div className="space-y-3">
                                
                                <RadioGroup value={question.correctAnswer.toString()} onValueChange={value => updateQuestion(qIndex, "correctAnswer", parseInt(value))}>
                                  {question.options.map((option, oIndex) => <div key={oIndex} className="flex items-center gap-2">
                                      <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} className="shrink-0" />
                                      <div className="flex-1">
                                        <Input placeholder={`Option ${oIndex + 1}`} value={option} onChange={e => updateOption(qIndex, oIndex, e.target.value)} />
                                      </div>
                                      {question.correctAnswer === oIndex && <span className="text-xs font-medium shrink-0 text-[#a5d160]">
                                          ✓ Correct
                                        </span>}
                                    </div>)}
                                </RadioGroup>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`explanation-${qIndex}`}>Explanation (Optional)</Label>
                                <Textarea id={`explanation-${qIndex}`} placeholder="Explain why this answer is correct..." value={question.explanation} onChange={e => updateQuestion(qIndex, "explanation", e.target.value)} rows={3} />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>)}
                    </Accordion>

                    <Button onClick={addQuestion} variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </div>

                  <Button onClick={handleCreateAssignment} className="w-full" disabled={submitting}>
                    {submitting ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </> : "Create Assignment"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments">
              <Card>
                <CardHeader>
                  <CardTitle>All Assignments</CardTitle>
                  <CardDescription>
                    View and manage assignments created by instructors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assignments.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      No assignments found
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Instructor</TableHead>
                          <TableHead>Questions</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
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
                              {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : "No due date"}
                            </TableCell>
                            <TableCell>
                              {new Date(assignment.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="destructive" onClick={() => deleteAssignment(assignment.id)}>
                                Delete
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
                  <CardTitle>All Submissions</CardTitle>
                  <CardDescription>
                    View student submissions and grades across all assignments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submissions.length === 0 ? <p className="text-center text-muted-foreground py-8">
                      No submissions found
                    </p> : <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Assignment</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Percentage</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map(submission => <TableRow key={submission.id}>
                            <TableCell className="font-medium">
                              {submission.student.full_name}
                            </TableCell>
                            <TableCell>{submission.assignment.title}</TableCell>
                            <TableCell>
                              {submission.score !== null ? `${submission.score}/${submission.total_questions}` : "Pending"}
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
                      <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().averageScore}%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().totalSubmissions}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calculateOverallStats().completedSubmissions}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
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
                      Assignment Analytics
                    </CardTitle>
                    <CardDescription>
                      Detailed score analysis for each assignment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assignments.length === 0 ? <p className="text-center text-muted-foreground py-8">
                        No assignments found
                      </p> : <div className="space-y-6">
                        {assignments.map(assignment => {
                    const stats = getAssignmentStats(assignment.id);
                    return <Card key={assignment.id}>
                              <CardHeader>
                                <CardTitle className="text-lg">{assignment.title}</CardTitle>
                                <CardDescription>
                                  By {assignment.instructor.full_name}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Average Score</p>
                                    <p className="text-2xl font-bold">{stats.averageScore}%</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Submissions</p>
                                    <p className="text-2xl font-bold">
                                      {stats.completedSubmissions}/{stats.totalSubmissions}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                                    <p className="text-2xl font-bold">{stats.completionRate}%</p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm font-medium mb-2">Grade Distribution</p>
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