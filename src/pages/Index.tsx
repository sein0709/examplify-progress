import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, UserCircle, FileText, Shield, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, hasRole, signOut, loading } = useAuth();

  // Redirect authenticated and verified users to their portal
  useEffect(() => {
    if (loading) return;
    
    if (user && profile?.verified) {
      if (hasRole("student")) {
        navigate("/student");
      } else if (hasRole("instructor")) {
        navigate("/instructor");
      } else if (hasRole("admin")) {
        navigate("/admin");
      }
    } else if (user && !profile?.verified) {
      navigate("/pending-approval");
    }
  }, [user, profile, hasRole, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card p-6 shadow-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8" style={{ color: '#474747' }} />
              <h1 className="text-3xl font-bold text-foreground">과제 관리 시스템</h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              과제 관리 및 온라인 평가를 위한 현대적인 플랫폼
            </p>
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {profile?.full_name || user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.verified ? "승인됨" : "승인 대기중"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          ) : (
            <Button onClick={() => navigate("/auth")}>
              로그인
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-8">
        <section className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-foreground">
            과제 관리 시스템에 오신 것을 환영합니다
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {user 
              ? "아래에서 개인 포털에 접근하세요"
              : "개인 학습 또는 교육 포털에 접근하려면 로그인하세요"}
          </p>
        </section>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {(!user || (user && profile?.verified && hasRole("student"))) && (
            <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-xl">
              <div className="p-8">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: '#F7EFE6' }}>
                  <UserCircle className="h-10 w-10" style={{ color: '#474747' }} />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-foreground">학생 포털</h3>
                <p className="mb-6 text-muted-foreground">
                  과제에 접근하고, 집중할 수 있는 환경에서 퀴즈를 풀고, 
                  학습 진도를 추적하세요.
                </p>
                <Button 
                  onClick={() => navigate(user ? "/student" : "/auth")} 
                  className="w-full"
                  size="lg"
                >
                  {user ? "포털 이동" : "로그인"}
                </Button>
              </div>
            </Card>
          )}

          {(!user || (user && profile?.verified && hasRole("instructor"))) && (
            <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-xl">
              <div className="p-8">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: '#F7EFE6' }}>
                  <FileText className="h-10 w-10" style={{ color: '#474747' }} />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-foreground">강사 포털</h3>
                <p className="mb-6 text-muted-foreground">
                  과제를 생성하고, 문제를 관리하고, 학생들의 성과를 
                  쉽게 모니터링하세요.
                </p>
                <Button 
                  onClick={() => navigate(user ? "/instructor" : "/auth")} 
                  className="w-full"
                  size="lg"
                >
                  {user ? "포털 이동" : "로그인"}
                </Button>
              </div>
            </Card>
          )}

          {(!user || (user && hasRole("admin"))) && (
            <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-xl">
              <div className="p-8">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: '#F7EFE6' }}>
                  <Shield className="h-10 w-10" style={{ color: '#474747' }} />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-foreground">관리자 포털</h3>
                <p className="mb-6 text-muted-foreground">
                  사용자 승인을 관리하고, 강사와 학생을 확인하고, 
                  플랫폼을 감독하세요.
                </p>
                <Button 
                  onClick={() => navigate(user ? "/admin" : "/auth")} 
                  className="w-full"
                  size="lg"
                >
                  {user ? "대시보드 이동" : "로그인"}
                </Button>
              </div>
            </Card>
          )}
        </div>

        <section className="mt-16">
          <h3 className="mb-8 text-center text-2xl font-bold text-foreground">주요 기능</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: '#F7EFE6' }}>
                  <BookOpen className="h-6 w-6" style={{ color: '#474747' }} />
                </div>
              </div>
              <h4 className="mb-2 font-semibold text-foreground">TOEFL 스타일 인터페이스</h4>
              <p className="text-sm text-muted-foreground">
                집중을 위해 최적화된 깔끔하고 방해 없는 퀴즈 환경
              </p>
            </Card>

            <Card className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: '#F7EFE6' }}>
                  <FileText className="h-6 w-6" style={{ color: '#474747' }} />
                </div>
              </div>
              <h4 className="mb-2 font-semibold text-foreground">간편한 과제 생성</h4>
              <p className="text-sm text-muted-foreground">
                강사를 위한 직관적인 객관식 문제 생성 도구
              </p>
            </Card>

            <Card className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: '#F7EFE6' }}>
                  <UserCircle className="h-6 w-6" style={{ color: '#474747' }} />
                </div>
              </div>
              <h4 className="mb-2 font-semibold text-foreground">진도 추적</h4>
              <p className="text-sm text-muted-foreground">
                실시간 피드백과 종합적인 성과 분석
              </p>
            </Card>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t bg-card p-6">
        <div className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>© 2024 과제 관리 시스템. 현대 교육을 위해 제작되었습니다.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
