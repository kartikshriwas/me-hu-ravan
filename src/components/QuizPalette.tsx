'use client';

import { QuizUserAnswer } from '@/lib/types';

interface QuizPaletteProps {
  totalQuestions: number;
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  userAnswers: Record<string, QuizUserAnswer>;
  questionIds: string[];
}

export function QuizPalette({
  totalQuestions,
  currentIndex,
  onSelectIndex,
  userAnswers,
  questionIds,
}: QuizPaletteProps) {
  let answeredCount = 0;
  let markedCount = 0;
  let unansweredCount = 0;

  questionIds.forEach((qId) => {
    const ans = userAnswers[qId];
    if (ans?.selectedOptionId) {
      answeredCount++;
    } else {
      unansweredCount++;
    }
    if (ans?.isMarkedForReview) {
      markedCount++;
    }
  });

  return (
    <div className="glass-panel rounded-2xl p-5 border border-card-border space-y-5">
      
      {/* Title & Stats */}
      <div className="flex items-center justify-between border-b border-card-border/80 pb-3">
        <h3 className="text-sm font-bold text-foreground">Question Navigator</h3>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-foreground/80">
          {totalQuestions} Questions
        </span>
      </div>

      {/* Legend Badge Status Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-medium">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-card/80 border border-card-border/80">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-foreground/80 truncate">Answered ({answeredCount})</span>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-card/80 border border-card-border/80">
          <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
          <span className="text-foreground/80 truncate">Marked ({markedCount})</span>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-card/80 border border-card-border/80">
          <span className="w-3 h-3 rounded-full bg-slate-700 shrink-0" />
          <span className="text-foreground/80 truncate">Pending ({unansweredCount})</span>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-card/80 border border-card-border/80">
          <span className="w-3 h-3 rounded-full bg-primary-500 shrink-0 ring-2 ring-primary-400/50" />
          <span className="text-foreground/80 truncate">Current</span>
        </div>
      </div>

      {/* Questions Grid Navigator */}
      <div className="pt-2">
        <div className="grid grid-cols-5 gap-2.5 max-h-[380px] overflow-y-auto p-1 text-center">
          {Array.from({ length: totalQuestions }).map((_, idx) => {
            const qId = questionIds[idx];
            const ans = userAnswers[qId];
            const isSelected = ans?.selectedOptionId !== null && ans?.selectedOptionId !== undefined;
            const isMarked = ans?.isMarkedForReview;
            const isCurrent = currentIndex === idx;

            let badgeStyle = 'bg-card/90 text-foreground/80 border-card-border hover:bg-slate-800 hover:text-foreground';

            if (isSelected && isMarked) {
              badgeStyle = 'bg-primary-600/30 text-primary-200 border-primary-500/80 font-bold';
            } else if (isSelected) {
              badgeStyle = 'bg-emerald-600/30 text-emerald-200 border-emerald-500/80 font-bold';
            } else if (isMarked) {
              badgeStyle = 'bg-amber-500/30 text-amber-200 border-amber-400/80 font-bold';
            }

            if (isCurrent) {
              badgeStyle = 'bg-primary-600 text-white border-2 border-primary-400 font-black shadow-lg shadow-primary-600/30 scale-105 z-10';
            }

            return (
              <button
                key={idx}
                onClick={() => onSelectIndex(idx)}
                className={`h-10 rounded-xl border flex items-center justify-center text-sm font-bold transition-all duration-150 active:scale-95 ${badgeStyle}`}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
