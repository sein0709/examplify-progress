import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Plus, Eye, EyeOff } from "lucide-react";
import { MathDisplay } from "./MathDisplay";

export interface ParsedQuestion {
  text: string;
  options: string[];
  correctAnswer: number | null;
  explanation: string;
  questionType: 'multiple_choice' | 'free_response';
  modelAnswer: string;
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

      const firstLine = lines[0].trim();
      
      // Check if it's a free response question
      const isFreeResponse = firstLine.startsWith("[서술형]") || firstLine.startsWith("[FR]");
      
      if (isFreeResponse) {
        // Free response question format:
        // [서술형] Question text
        // Model answer (can include LaTeX)
        const questionText = firstLine.replace(/^\[서술형\]|\[FR\]/, "").trim();
        const modelAnswer = lines.slice(1).join("\n").trim();

        questions.push({
          text: questionText,
          options: [...DEFAULT_OPTIONS],
          correctAnswer: null,
          explanation: "",
          questionType: 'free_response',
          modelAnswer,
        });
      } else {
        // Multiple choice question format:
        // Question text
        // Correct answer number (1-5)
        const questionText = firstLine;
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
          questionType: 'multiple_choice',
          modelAnswer: "",
        });
      }
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
          객관식 및 서술형 문제를 한 번에 추가하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <Alert className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-2">
            <div>
              <strong>객관식:</strong> 첫 줄에 문제, 둘째 줄에 정답 번호(1-5)
            </div>
            <div>
              <strong>서술형:</strong> <code>[서술형]</code> 접두사와 문제, 둘째 줄에 모범답안 (LaTeX 지원)
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2 flex-1 flex flex-col">
          <Label>문제 붙여넣기</Label>
          <Textarea
            placeholder={`프랑스의 수도는 무엇인가요?
3

[서술형] x²의 미분값을 구하시오.
2x

가장 큰 행성은 무엇인가요?
4

[서술형] 이차방정식의 근의 공식을 작성하시오.
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`}
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      q.questionType === 'free_response' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    }`}>
                      {q.questionType === 'free_response' ? '서술형' : '객관식'}
                    </span>
                  </div>
                  <div className="font-medium">Q{i + 1}: {q.text}</div>
                  {q.questionType === 'multiple_choice' ? (
                    <div className="text-muted-foreground mt-1">
                      정답: 선택지 {(q.correctAnswer ?? 0) + 1}
                    </div>
                  ) : (
                    <div className="text-muted-foreground mt-1">
                      모범답안: <MathDisplay latex={q.modelAnswer} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
