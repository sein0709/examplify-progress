import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PendingApproval = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      navigate("/auth");
      return;
    }

    // Redirect if already verified
    if (profile?.verified) {
      navigate("/");
      return;
    }
  }, [user, profile, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Homework Hub</h1>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
            <Clock className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-foreground">
              Pending Approval
            </h2>
            <p className="text-muted-foreground">
              Thank you for registering! Your account is currently awaiting approval from an administrator.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll be able to access the platform once your account has been verified. This usually takes 1-2 business days.
            </p>
          </div>

          {profile && (
            <div className="w-full space-y-2 rounded-lg bg-accent/10 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{profile.full_name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-amber-600">Pending</span>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PendingApproval;
