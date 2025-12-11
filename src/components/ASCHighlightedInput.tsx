import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ASCHighlightedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function tokenizeASC(input: string): { type: 'prefix' | 'mcq' | 'frq' | 'frq-content' | 'error' | 'whitespace'; value: string }[] {
  const tokens: { type: 'prefix' | 'mcq' | 'frq' | 'frq-content' | 'error' | 'whitespace'; value: string }[] = [];
  
  const colonIndex = input.indexOf(':');
  if (colonIndex === -1) {
    tokens.push({ type: 'error', value: input });
    return tokens;
  }
  
  // Add prefix (count + colon)
  tokens.push({ type: 'prefix', value: input.substring(0, colonIndex + 1) });
  
  const answerPart = input.substring(colonIndex + 1);
  let i = 0;
  
  while (i < answerPart.length) {
    const char = answerPart[i];
    
    // Whitespace
    if (/\s/.test(char)) {
      tokens.push({ type: 'whitespace', value: char });
      i++;
      continue;
    }
    
    // MCQ: digits 1-5
    if (/[1-5]/.test(char)) {
      tokens.push({ type: 'mcq', value: char });
      i++;
      continue;
    }
    
    // Invalid digit
    if (/[0-9]/.test(char)) {
      tokens.push({ type: 'error', value: char });
      i++;
      continue;
    }
    
    // FRQ: F or F(answer)
    if (char === 'F' || char === 'f') {
      const nextIndex = i + 1;
      
      if (nextIndex < answerPart.length && answerPart[nextIndex] === '(') {
        // Find balanced closing parenthesis
        let depth = 0;
        let endIndex = nextIndex;
        
        for (let j = nextIndex; j < answerPart.length; j++) {
          if (answerPart[j] === '(') depth++;
          else if (answerPart[j] === ')') {
            depth--;
            if (depth === 0) {
              endIndex = j;
              break;
            }
          }
        }
        
        if (depth === 0) {
          tokens.push({ type: 'frq', value: char });
          tokens.push({ type: 'frq-content', value: answerPart.substring(nextIndex, endIndex + 1) });
          i = endIndex + 1;
        } else {
          // Unbalanced - mark F as frq and rest as error
          tokens.push({ type: 'frq', value: char });
          tokens.push({ type: 'error', value: answerPart.substring(nextIndex) });
          break;
        }
      } else {
        tokens.push({ type: 'frq', value: char });
        i++;
      }
      continue;
    }
    
    // Unknown character
    tokens.push({ type: 'error', value: char });
    i++;
  }
  
  return tokens;
}

export const ASCHighlightedInput = ({ value, onChange, placeholder, className }: ASCHighlightedInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  const tokens = value ? tokenizeASC(value) : [];

  return (
    <div className={cn("relative font-mono", className)}>
      {/* Highlighted layer */}
      <div 
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none overflow-hidden whitespace-pre px-3 py-2 text-sm border border-transparent"
        aria-hidden="true"
      >
        {tokens.map((token, i) => {
          let colorClass = "";
          switch (token.type) {
            case 'prefix':
              colorClass = "text-muted-foreground";
              break;
            case 'mcq':
              colorClass = "text-accent-foreground bg-accent/60 rounded-sm";
              break;
            case 'frq':
              colorClass = "text-blue-600 dark:text-blue-400";
              break;
            case 'frq-content':
              colorClass = "text-blue-500 dark:text-blue-300";
              break;
            case 'error':
              colorClass = "text-destructive bg-destructive/20 rounded-sm";
              break;
            case 'whitespace':
              colorClass = "";
              break;
          }
          return (
            <span key={i} className={colorClass}>
              {token.value}
            </span>
          );
        })}
      </div>
      
      {/* Actual input (transparent text) */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-transparent text-transparent caret-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  );
};
