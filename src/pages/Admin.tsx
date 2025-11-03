import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, ArrowLeft, Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  id: string;
  full_name: string | null;
  verified: boolean;
  created_at: string;
}

interface UserWithEmail extends UserProfile {
  email: string;
  role: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserWithEmail[]>([]);
  const [verifiedUsers, setVerifiedUsers] = useState<UserWithEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasRole("admin")) {
      navigate("/");
      return;
    }
    fetchUsers();
  }, [hasRole, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine data with profiles
      const usersWithDetails: UserWithEmail[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        
        return {
          ...profile,
          email: "user@example.com", // Note: Email not accessible from client
          role: userRole?.role || "none",
        };
      });

      setPendingUsers(usersWithDetails.filter((u) => !u.verified));
      setVerifiedUsers(usersWithDetails.filter((u) => u.verified));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verified: true })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "User approved",
        description: "User has been granted access to the system",
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      // Delete from profiles (will cascade to user_roles via RLS)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "User rejected",
        description: "User has been removed from the system",
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    }
  };

  const revokeAccess = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verified: false })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Access revoked",
        description: "User access has been revoked",
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke access",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card p-4 shadow-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 space-y-8">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Pending Approval ({pendingUsers.length})
          </h2>
          {loading ? (
            <Card className="p-8 text-center text-muted-foreground">
              Loading...
            </Card>
          ) : pendingUsers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No pending approvals
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || "N/A"}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => approveUser(user.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectUser(user.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Verified Users ({verifiedUsers.length})
          </h2>
          {verifiedUsers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No verified users yet
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifiedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || "N/A"}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeAccess(user.id)}
                        >
                          Revoke Access
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;
