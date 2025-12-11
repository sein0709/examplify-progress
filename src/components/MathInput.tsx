import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MathDisplay } from "./MathDisplay";
import { FunctionSquare, Sigma, Divide, Superscript, Subscript, Pi, SquareRadical } from "lucide-react";

interface MathInputProps {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  className?: string;
}

const MATH_SYMBOLS = [
  { label: "분수", latex: "\\frac{}{}", display: "a/b", cursor: 6 },
  { label: "제곱", latex: "^{}", display: "x²", cursor: 2 },
  { label: "아래첨자", latex: "_{}", display: "x₁", cursor: 2 },
  { label: "제곱근", latex: "\\sqrt{}", display: "√x", cursor: 6 },
  { label: "n제곱근", latex: "\\sqrt[]{}", display: "ⁿ√x", cursor: 6 },
  { label: "파이", latex: "\\pi", display: "π", cursor: 3 },
  { label: "시그마", latex: "\\sum_{i=1}^{n}", display: "Σ", cursor: 13 },
  { label: "적분", latex: "\\int_{a}^{b}", display: "∫", cursor: 11 },
  { label: "무한대", latex: "\\infty", display: "∞", cursor: 6 },
  { label: "곱하기", latex: "\\times", display: "×", cursor: 6 },
  { label: "나누기", latex: "\\div", display: "÷", cursor: 4 },
  { label: "플러스마이너스", latex: "\\pm", display: "±", cursor: 3 },
  { label: "같지않음", latex: "\\neq", display: "≠", cursor: 4 },
  { label: "작거나같음", latex: "\\leq", display: "≤", cursor: 4 },
  { label: "크거나같음", latex: "\\geq", display: "≥", cursor: 4 },
  { label: "알파", latex: "\\alpha", display: "α", cursor: 6 },
  { label: "베타", latex: "\\beta", display: "β", cursor: 5 },
  { label: "세타", latex: "\\theta", display: "θ", cursor: 6 },
  { label: "델타", latex: "\\Delta", display: "Δ", cursor: 6 },
  { label: "람다", latex: "\\lambda", display: "λ", cursor: 7 },
];

export const MathInput = ({ value, onChange, placeholder, className }: MathInputProps) => {
  const [showPreview, setShowPreview] = useState(false);

  const insertSymbol = (latex: string) => {
    onChange(value + latex);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-lg border">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8">
              <FunctionSquare className="h-4 w-4 mr-1" />
              수식 기호
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {MATH_SYMBOLS.map((symbol) => (
                <Button
                  key={symbol.latex}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-lg font-normal"
                  onClick={() => insertSymbol(symbol.latex)}
                  title={symbol.label}
                >
                  {symbol.display}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant={showPreview ? "secondary" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? "편집" : "미리보기"}
        </Button>
      </div>

      {showPreview ? (
        <div className="min-h-[100px] p-4 border rounded-lg bg-background flex items-center justify-center">
          {value ? (
            <MathDisplay latex={value} block />
          ) : (
            <span className="text-muted-foreground">수식을 입력해주세요</span>
          )}
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "LaTeX 수식을 입력하세요 (예: \\frac{a}{b}, x^2, \\sqrt{x})"}
          className="font-mono min-h-[100px]"
        />
      )}

      {value && !showPreview && (
        <div className="p-2 bg-muted/20 rounded border text-sm">
          <span className="text-muted-foreground mr-2">미리보기:</span>
          <MathDisplay latex={value} />
        </div>
      )}
    </div>
  );
};
