import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathDisplayProps {
  latex: string;
  block?: boolean;
  className?: string;
}

export const MathDisplay = ({ latex, block = false, className = "" }: MathDisplayProps) => {
  if (!latex) return null;
  
  try {
    if (block) {
      return (
        <div className={className}>
          <BlockMath math={latex} />
        </div>
      );
    }
    return (
      <span className={className}>
        <InlineMath math={latex} />
      </span>
    );
  } catch (error) {
    // If LaTeX parsing fails, show raw text
    return <span className={className}>{latex}</span>;
  }
};
