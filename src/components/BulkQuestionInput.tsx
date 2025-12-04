import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Plus, Eye, EyeOff } from "lucide-react";

interface ParsedQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface BulkQuestionInputProps {
  onAddQuestions: (questions: ParsedQuestion[]) => void;
}

const DEFAULT_OPTIONS = ["1", "2", "3", "4", "5"];

export const BulkQuestionInput = ({ onAddQuestions }: BulkQuestionInputProps) => {
  const [bulkText, setBulkText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseQuestions = (text: string): ParsedQuestion[] => {
    const questions: ParsedQuestion[] = [];
    const blocks = text.trim().split(/\n\s*\n/); // Split by blank lines

    for (const block of blocks) {
      const lines = block.trim().split("\n").filter(line => line.trim());
      if (lines.length < 2) continue;

      const questionText = lines[0].trim();
      const correctAnswerLine = lines[1].trim();
      const correctAnswer = parseInt(correctAnswerLine) - 1; // Convert 1-5 to 0-4

      if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 4) {
        throw new Error(`문제 "${questionText}"의 정답 번호 "${correctAnswerLine}"이(가) 올바르지 않습니다. 1-5 사이여야 합니다.`);
      }

      questions.push({
        text: questionText,
        options: [...DEFAULT_OPTIONS],
        correctAnswer,
        explanation: "",
      });
    }

    return questions;
  };

  const handlePreview = () => {
    setParseError(null);
    try {
      const parsed = parseQuestions(bulkText);
      if (parsed.length === 0) {
        setParseError("문제를 찾을 수 없습니다. 형식을 확인해주세요.");
        return;
      }
      setParsedQuestions(parsed);
      setShowPreview(true);
    } catch (error: any) {
      setParseError(error.message);
    }
  };

  const handleAdd = () => {
    if (parsedQuestions.length > 0) {
      onAddQuestions(parsedQuestions);
      setBulkText("");
      setParsedQuestions([]);
      setShowPreview(false);
    }
  };

  return (
    <Card className="h-full flex flex-col border-2 border-dashed border-accent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          문제 일괄 추가
        </CardTitle>
        <CardDescription>
          간단한 텍스트 형식을 사용하여 여러 문제를 한 번에 빠르게 추가하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <Alert className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>형식:</strong> 각 문제는 첫 번째 줄에 문제 텍스트가 있어야 하고, 
            두 번째 줄에 정답 번호(1-5)가 있어야 합니다. 
            문제 사이에 빈 줄로 구분하세요. 선택지는 기본적으로 1-5로 번호가 매겨집니다.
          </AlertDescription>
        </Alert>

        <div className="space-y-2 flex-1 flex flex-col">
          <Label>문제 붙여넣기</Label>
          <Textarea
            placeholder={`프랑스의 수도는 무엇인가요?
3

2+2는 얼마인가요?
2

가장 큰 행성은 무엇인가요?
4`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="font-mono text-sm flex-1 min-h-[200px]"
          />
        </div>

        {parseError && (
          <Alert variant="destructive">
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!bulkText.trim()}
          >
            {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showPreview ? "미리보기 숨기기" : "문제 미리보기"}
          </Button>
          {showPreview && parsedQuestions.length > 0 && (
            <Button type="button" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              {parsedQuestions.length}개 문제 추가
            </Button>
          )}
        </div>

        {showPreview && parsedQuestions.length > 0 && (
          <div className="space-y-3 mt-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold text-sm">미리보기 ({parsedQuestions.length}개 문제)</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedQuestions.map((q, i) => (
                <div key={i} className="p-3 bg-background rounded border text-sm">
                  <div className="font-medium">Q{i + 1}: {q.text}</div>
                  <div className="text-muted-foreground mt-1">
                    정답: 선택지 {q.correctAnswer + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
