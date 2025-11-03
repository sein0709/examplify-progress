import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, signInSchema, SignUpFormData, SignInFormData } from "@/lib/validations";
import { ZodError } from "zod";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [signUpData, setSignUpData] = useState<SignUpFormData>({
    email: "",
    password: "",
    fullName: "",
    role: "student",
  });

  const [signInData, setSignInData] = useState<SignInFormData>({
    email: "",
    password: "",
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validatedData = signUpSchema.parse(signUpData);

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            full_name: validatedData.fullName,
            role: validatedData.role,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Insert the role into user_roles table
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: validatedData.role,
        });

        if (roleError) {
          console.error("Error assigning role:", roleError);
        }

        toast({
          title: "Account created!",
          description: "Please wait for admin approval to access the system.",
        });
        navigate("/pending-approval");
      }
    } catch (error) {
      if (error instanceof ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validatedData = signInSchema.parse(signInData);

      // Sign in with Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
      navigate("/");
    } catch (error) {
      if (error instanceof ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Homework Hub</h1>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={signInData.email}
                  onChange={(e) =>
                    setSignInData({ ...signInData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={signInData.password}
                  onChange={(e) =>
                    setSignInData({ ...signInData, password: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  value={signUpData.fullName}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, fullName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={signUpData.email}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signUpData.password}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, password: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">I am a...</Label>
                <RadioGroup
                  value={signUpData.role}
                  onValueChange={(value: "instructor" | "student") =>
                    setSignUpData({ ...signUpData, role: value })
                  }
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3 rounded-lg border-2 border-border bg-card p-4 transition-all hover:border-primary hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:shadow-sm">
                    <RadioGroupItem value="student" id="student" />
                    <Label htmlFor="student" className="flex-1 font-medium cursor-pointer text-base">
                      Student
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border-2 border-border bg-card p-4 transition-all hover:border-primary hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:shadow-sm">
                    <RadioGroupItem value="instructor" id="instructor" />
                    <Label htmlFor="instructor" className="flex-1 font-medium cursor-pointer text-base">
                      Instructor
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all" 
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Note: Your account will need to be verified by an administrator before you can access the system.
        </p>
      </Card>
    </div>
  );
};

export default Auth;
