import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, signInSchema, SignUpFormData, SignInFormData } from "@/lib/validations";
import { ZodError } from "zod";
import { cn } from "@/lib/utils";

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
        // Insert the role into user_roles table - this is CRITICAL
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: validatedData.role,
        });

        if (roleError) {
          // Role assignment is critical - if it fails, inform the user
          console.error("Error assigning role:", roleError);
          toast({
            title: "경고: 계정 생성됨",
            description: "계정이 생성되었으나 역할 할당에 실패했습니다. 관리자에게 문의하세요.",
            variant: "destructive",
          });
          navigate("/pending-approval");
          return;
        }

        toast({
          title: "계정이 생성되었습니다!",
          description: "시스템 접근을 위해 관리자 승인을 기다려주세요.",
        });
        navigate("/pending-approval");
      }
    } catch (error) {
      if (error instanceof ZodError) {
        toast({
          title: "유효성 검사 오류",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "오류",
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
        title: "환영합니다!",
        description: "성공적으로 로그인되었습니다.",
      });
      navigate("/");
    } catch (error) {
      if (error instanceof ZodError) {
        toast({
          title: "유효성 검사 오류",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "오류",
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
          <h1 className="text-2xl font-bold text-foreground">과제 관리 시스템</h1>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">로그인</TabsTrigger>
            <TabsTrigger value="signup">회원가입</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">이메일</Label>
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
                <Label htmlFor="signin-password">비밀번호</Label>
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
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary animate-fade-in" 
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    로그인 중...
                  </span>
                ) : (
                  "로그인"
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">이름</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="홍길동"
                  value={signUpData.fullName}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, fullName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">이메일</Label>
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
                <Label htmlFor="signup-password">비밀번호</Label>
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
                <Label className="text-base font-semibold">역할 선택</Label>
                <RadioGroup
                  value={signUpData.role}
                  onValueChange={(value: "instructor" | "student") =>
                    setSignUpData({ ...signUpData, role: value })
                  }
                  className="gap-3"
                >
                  <div 
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border-2 p-4 transition-all hover:border-primary",
                      signUpData.role === "student" 
                        ? "border-primary shadow-sm" 
                        : "border-border bg-card hover:bg-accent/50"
                    )}
                    style={signUpData.role === "student" ? { backgroundColor: '#F7EFE6' } : undefined}
                  >
                    <RadioGroupItem value="student" id="student" />
                    <Label htmlFor="student" className="flex-1 font-medium cursor-pointer text-base">
                      학생
                    </Label>
                  </div>
                  <div 
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border-2 p-4 transition-all hover:border-primary",
                      signUpData.role === "instructor" 
                        ? "border-primary shadow-sm" 
                        : "border-border bg-card hover:bg-accent/50"
                    )}
                    style={signUpData.role === "instructor" ? { backgroundColor: '#F7EFE6' } : undefined}
                  >
                    <RadioGroupItem value="instructor" id="instructor" />
                    <Label htmlFor="instructor" className="flex-1 font-medium cursor-pointer text-base">
                      강사
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all" 
                disabled={loading}
              >
                {loading ? "계정 생성 중..." : "계정 생성"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          참고: 시스템 접근 전 관리자의 계정 승인이 필요합니다.
        </p>
      </Card>
    </div>
  );
};

export default Auth;
