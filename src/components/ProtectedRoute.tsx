import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireVerified?: boolean;
  requiredRole?: "admin" | "instructor" | "student";
}

export const ProtectedRoute = ({
  children,
  requireVerified = false,
  requiredRole,
}: ProtectedRouteProps) => {
  const { user, profile, hasRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    // If not authenticated, redirect to auth page
    if (!user) {
      navigate("/auth");
      return;
    }

    // If verification is required and user is not verified, redirect to pending approval
    if (requireVerified && profile && !profile.verified) {
      navigate("/pending-approval");
      return;
    }

    // If specific role is required and user doesn't have it, redirect to home
    if (requiredRole && !hasRole(requiredRole)) {
      navigate("/");
      return;
    }
  }, [user, profile, loading, requireVerified, requiredRole, hasRole, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show loading while checking conditions
  if (!user || (requireVerified && !profile?.verified) || (requiredRole && !hasRole(requiredRole))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};
