'use client';

import { QuestionBlock } from '@/lib/types';
import { Bookmark, CheckCircle2, XCircle, BookmarkCheck, HelpCircle, Lightbulb, Check } from 'lucide-react';
import DOMPurify from 'dompurify';

interface QuestionRendererProps {
  question: QuestionBlock;
  currentNumber: number;
  totalQuestions: number;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  isMarkedForReview: boolean;
  onToggleMarkForReview?: () => void;
  isBookmarked: boolean;
  onToggleBookmark?: () => void;
  showSolutionImmediately?: boolean;
}

export function QuestionRenderer({
  question,
  currentNumber,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  isMarkedForReview,
  onToggleMarkForReview,
  isBookmarked,
  onToggleBookmark,
  showSolutionImmediately = false
}: QuestionRendererProps) {

  const cleanText = (str?: string | null) => (str || '').replace(/<[^>]*>/g, '').trim().toLowerCase();

  // Find correct option object
  const correctOptionIndex = question.options.findIndex(
    (o) =>
      o.id === question.correctOptionId ||
      (question.correctOptionText && cleanText(o.text) === cleanText(question.correctOptionText))
  );
  const targetIndex = correctOptionIndex !== -1 ? correctOptionIndex : 0;
  const correctOption = question.options[targetIndex] || null;
  const correctLetter = String.fromCharCode(65 + targetIndex);

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-8 border border-card-border shadow-xl relative overflow-hidden space-y-4 sm:space-y-6">
      
      {/* Subtle Gradient Glow Background */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-primary-500/10 via-primary-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header Info Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-card-border/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary-600/20 text-primary-600 dark:text-primary-300 border border-primary-500/30 whitespace-nowrap">
            Q {currentNumber} / {totalQuestions}
          </span>
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap hidden xs:inline">
            Score: <strong className="text-foreground">{question.score} pt{question.score > 1 ? 's' : ''}</strong>
          </span>
          {typeof question.accuracyRate === 'number' && (
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 shrink-0 ${
              (question.totalAttempts || 0) > 0
                ? question.accuracyRate >= 70
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                  : question.accuracyRate >= 40
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
                : 'bg-slate-800 text-muted-foreground border-slate-700'
            }`}>
              <span>
                {(question.totalAttempts || 0) > 0
                  ? `🎯 ${question.accuracyRate}% Accuracy (${question.totalAttempts} ${question.totalAttempts === 1 ? 'Attempt' : 'Attempts'})`
                  : '✨ New Question'}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!showSolutionImmediately && onToggleMarkForReview && (
            <button
              onClick={onToggleMarkForReview}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isMarkedForReview
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-card text-foreground/80 border border-card-border hover:bg-slate-800'
              }`}
              title="Mark for review"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{isMarkedForReview ? 'Marked' : 'Mark'}</span>
            </button>
          )}

          {onToggleBookmark && (
            <button
              onClick={onToggleBookmark}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                isBookmarked
                  ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300 border border-primary-500/40'
                  : 'bg-card text-muted-foreground border border-card-border hover:text-foreground'
              }`}
              title={isBookmarked ? 'Saved to Bookmarks' : 'Bookmark Question'}
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Question HTML Text */}
      <div>
        <div 
          suppressHydrationWarning
          className="text-base sm:text-lg text-foreground font-medium question-html-content leading-relaxed"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.htmlText) }}
        />
      </div>

      {/* Option Choices */}
      <div className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect =
            showSolutionImmediately &&
            (option.id === question.correctOptionId ||
              (question.correctOptionText && option.text.trim() === question.correctOptionText?.trim()));
          const isWrong = showSolutionImmediately && isSelected && !isCorrect;

          const letterIndex = String.fromCharCode(65 + index); // A, B, C, D...

          let optionStyle = 'bg-card/60 border-card-border hover:border-slate-700 hover:bg-slate-800/50 text-foreground/80';
          let badgeStyle = 'bg-slate-800 text-muted-foreground border-slate-700';

          if (isSelected && !showSolutionImmediately) {
            optionStyle = 'bg-primary-950/60 border-primary-500/80 text-white ring-1 ring-primary-500/40 shadow-lg shadow-primary-950/40';
            badgeStyle = 'bg-primary-600 text-white border-primary-400';
          }

          if (showSolutionImmediately) {
            if (isCorrect) {
              optionStyle = 'bg-emerald-950/80 border-emerald-500/90 text-emerald-100 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-950/50';
              badgeStyle = 'bg-emerald-600 text-white border-emerald-400';
            } else if (isWrong) {
              optionStyle = 'bg-rose-950/80 border-rose-500/90 text-rose-100 ring-2 ring-rose-500/50 shadow-md shadow-rose-950/50';
              badgeStyle = 'bg-rose-600 text-white border-rose-400';
            }
          }

          return (
            <button
              key={option.id}
              disabled={showSolutionImmediately}
              onClick={() => !showSolutionImmediately && onSelectOption(option.id)}
              className={`w-full text-left p-3 sm:p-4 rounded-xl border flex items-start gap-3 sm:gap-4 transition-all duration-200 group ${optionStyle}`}
            >
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${badgeStyle}`}>
                {letterIndex}
              </div>

              <div 
                suppressHydrationWarning
                className="text-sm sm:text-base font-normal pt-0.5 question-html-content flex-1"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(option.text) }}
              />

              {showSolutionImmediately ? (
                isCorrect ? (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                    <Check className="w-3.5 h-3.5" /> Correct Answer
                  </span>
                ) : isWrong ? (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0">
                    <XCircle className="w-3.5 h-3.5" /> Your Choice
                  </span>
                ) : null
              ) : (
                isSelected && <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Post-Test Explanation & Solution Box */}
      {showSolutionImmediately && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-primary-500/30 shadow-lg text-sm space-y-4">
          <div className="flex items-center justify-between border-b border-card-border/80 pb-3">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-300 font-bold">
              <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Detailed Solution & Explanation</span>
            </div>

            {correctOption && (
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span>Correct Option:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 font-bold text-white flex items-center gap-1">
                  <span>Option {correctLetter}:</span>
                  <span suppressHydrationWarning dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(correctOption.text) }} />
                </span>
              </div>
            )}
          </div>

          {question.explanationHtml ? (
            <div 
              suppressHydrationWarning
              className="text-foreground question-html-content leading-relaxed text-sm sm:text-base"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.explanationHtml) }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              The correct answer for this question is Option {correctLetter}. Refer to the step-by-step option breakdown above.
            </p>
          )}
        </div>
      )}

    </div>
  );
}
