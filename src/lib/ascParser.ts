import type { ParsedQuestion } from "@/components/BulkQuestionInput";

export interface ASCParseResult {
  success: true;
  questions: ParsedQuestion[];
}

export interface ASCParseError {
  success: false;
  error: string;
}

const DEFAULT_OPTIONS = ["1", "2", "3", "4", "5"];

function parseBalancedParentheses(input: string, startIndex: number): { content: string; endIndex: number } | null {
  if (input[startIndex] !== '(') return null;
  
  let depth = 0;
  let content = '';
  
  for (let i = startIndex; i < input.length; i++) {
    const char = input[i];
    
    if (char === '(') {
      depth++;
      if (depth > 1) content += char;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return { content, endIndex: i };
      }
      content += char;
    } else {
      content += char;
    }
  }
  
  return null; // Unbalanced parentheses
}

export function parseASC(input: string): ASCParseResult | ASCParseError {
  const trimmed = input.trim();
  
  // Extract count prefix (e.g., "10:")
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    return { success: false, error: "형식 오류: 'N:' 형식으로 문제 개수를 지정해주세요. (예: 10: 12345)" };
  }
  
  const countStr = trimmed.substring(0, colonIndex).trim();
  const expectedCount = parseInt(countStr, 10);
  
  if (isNaN(expectedCount) || expectedCount <= 0) {
    return { success: false, error: "문제 개수가 올바르지 않습니다. 양의 정수를 입력해주세요." };
  }
  
  const answerPart = trimmed.substring(colonIndex + 1).trim();
  const questions: ParsedQuestion[] = [];
  
  let i = 0;
  while (i < answerPart.length) {
    const char = answerPart[i];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // MCQ: digits 1-5
    if (/[1-5]/.test(char)) {
      questions.push({
        text: `문제 ${questions.length + 1}`,
        options: [...DEFAULT_OPTIONS],
        correctAnswer: parseInt(char, 10) - 1, // Convert 1-5 to 0-4
        explanation: "",
        questionType: 'multiple_choice',
        modelAnswer: "",
      });
      i++;
      continue;
    }
    
    // Invalid MCQ digit
    if (/[0-9]/.test(char)) {
      return { success: false, error: `잘못된 MCQ 정답입니다: "${char}". 1-5 사이의 숫자만 가능합니다.` };
    }
    
    // FRQ: F or F(answer)
    if (char === 'F' || char === 'f') {
      const nextIndex = i + 1;
      
      // Check if followed by parentheses
      if (nextIndex < answerPart.length && answerPart[nextIndex] === '(') {
        const result = parseBalancedParentheses(answerPart, nextIndex);
        
        if (!result) {
          return { success: false, error: "괄호가 올바르게 닫히지 않았습니다." };
        }
        
        questions.push({
          text: `문제 ${questions.length + 1}`,
          options: [...DEFAULT_OPTIONS],
          correctAnswer: null,
          explanation: "",
          questionType: 'free_response',
          modelAnswer: result.content,
        });
        
        i = result.endIndex + 1;
      } else {
        // FRQ without model answer
        questions.push({
          text: `문제 ${questions.length + 1}`,
          options: [...DEFAULT_OPTIONS],
          correctAnswer: null,
          explanation: "",
          questionType: 'free_response',
          modelAnswer: "",
        });
        i++;
      }
      continue;
    }
    
    // Unknown character
    return { success: false, error: `알 수 없는 문자입니다: "${char}"` };
  }
  
  // Validate count
  if (questions.length !== expectedCount) {
    return { 
      success: false, 
      error: `정답 개수가 일치하지 않습니다. 입력: ${questions.length}개, 예상: ${expectedCount}개` 
    };
  }
  
  if (questions.length === 0) {
    return { success: false, error: "문제를 찾을 수 없습니다." };
  }
  
  return { success: true, questions };
}
