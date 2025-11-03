import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  questions: { count: number }[];
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
  };
}

const Admin = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<UserWithEmail[]>([]);
  const [students, setStudents] = useState<UserWithEmail[]>([]);
  const [instructors, setInstructors] = useState<UserWithEmail[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles.map((profile) => {
        const userRole = roles.find((role) => role.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role || "No role assigned",
        };
      });

      setPendingUsers(usersWithRoles.filter((user) => !user.verified));
      setStudents(usersWithRoles.filter((user) => user.verified && user.role === "student"));
      setInstructors(usersWithRoles.filter((user) => user.verified && user.role === "instructor"));
    } catch (error: any) {
      toast.error("Failed to fetch users: " + error.message);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
          *,
          instructor:profiles!instructor_id(full_name),
          questions(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch assignments: " + error.message);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(`
          *,
          student:profiles!student_id(full_name),
          assignment:assignments(title)
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch submissions: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasRole("admin")) {
      navigate("/");
    } else {
      fetchUsers();
      fetchAssignments();
      fetchSubmissions();
    }
  }, [hasRole, navigate]);

  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verified: true })
        .eq("id", userId);

      if (error) throw error;

      toast.success("User approved successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to approve user: " + error.message);
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast.success("User rejected successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to reject user: " + error.message);
    }
  };

  const revokeAccess = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verified: false })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Access revoked successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to revoke access: " + error.message);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to delete user: " + error.message);
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
      fetchAssignments();
    } catch (error: any) {
      toast.error("Failed to delete assignment: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
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
                  {pendingUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No pending users
                    </p>
                  ) : (
                    <Table>
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
                        {pendingUsers.map((user) => (
                          <TableRow key={user.id}>
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
                                <Button
                                  size="sm"
                                  onClick={() => approveUser(user.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectUser(user.id)}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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
                  {students.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No students found
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name}
                            </TableCell>
                            <TableCell>{user.email || "N/A"}</TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => revokeAccess(user.id)}
                                >
                                  Revoke Access
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteUser(user.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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
                  {instructors.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No instructors found
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {instructors.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name}
                            </TableCell>
                            <TableCell>{user.email || "N/A"}</TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => revokeAccess(user.id)}
                                >
                                  Revoke Access
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteUser(user.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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
                  {assignments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No assignments found
                    </p>
                  ) : (
                    <Table>
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
                        {assignments.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {assignment.title}
                            </TableCell>
                            <TableCell>{assignment.instructor.full_name}</TableCell>
                            <TableCell>{assignment.questions[0]?.count || 0}</TableCell>
                            <TableCell>
                              {assignment.due_date
                                ? new Date(assignment.due_date).toLocaleDateString()
                                : "No due date"}
                            </TableCell>
                            <TableCell>
                              {new Date(assignment.created_at).toLocaleDateString()}
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
                  {submissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No submissions found
                    </p>
                  ) : (
                    <Table>
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
                        {submissions.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell className="font-medium">
                              {submission.student.full_name}
                            </TableCell>
                            <TableCell>{submission.assignment.title}</TableCell>
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Admin;
