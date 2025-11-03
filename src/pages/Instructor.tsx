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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, CalendarIcon, Loader2, Upload, FileText, Image } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

const Instructor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { text: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" },
  ]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentSubmissions, setSelectedAssignmentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyAssignments();
  }, [user]);

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

  const addQuestion = () => {
    setQuestions([...questions, { text: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }]);
  };

  const handleFileUpload = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
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
      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .insert({
          title: assignmentTitle,
          description: description || null,
          instructor_id: user?.id,
          due_date: dueDate?.toISOString() || null,
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
      setUploadedFile(null);
      setQuestions([{ text: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }]);
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
      <div className="max-w-4xl mx-auto space-y-6">
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
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Assignment</CardTitle>
                <CardDescription>Add questions and set a due date for your assignment</CardDescription>
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

              <div className="space-y-4">
                  <Label>Questions</Label>
                  {questions.map((question, qIndex) => (
                    <Card key={qIndex}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Question {qIndex + 1}</CardTitle>
                          {questions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeQuestion(qIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Input
                          placeholder="Enter question text"
                          value={question.text}
                          onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                        />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Select the correct answer:</Label>
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
                                />
                                <Label 
                                  htmlFor={`q${qIndex}-o${oIndex}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <Input
                                    placeholder={`Option ${oIndex + 1}`}
                                    value={option}
                                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                    className="flex-1"
                                  />
                                </Label>
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

                  <Button onClick={addQuestion} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
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
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteAssignment(assignment.id)}
                            >
                              Delete
                            </Button>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Instructor;
