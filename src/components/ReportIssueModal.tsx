import React, { useState } from 'react';
import { X, AlertTriangle, Send, Loader2 } from 'lucide-react';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  questionId: string;
}

const REPORT_OPTIONS = [
  'Incorrect Answer Key',
  'Incomplete Question',
  'Typo / Formatting',
  'Options Not Available',
  'Missing Diagram',
  'Other'
];

export function ReportIssueModal({ isOpen, onClose, quizId, questionId }: ReportIssueModalProps) {
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedIssue) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          questionId,
          issueType: selectedIssue,
          description
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setSelectedIssue('');
          setDescription('');
          onClose();
        }, 2000);
      } else {
        alert('Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl p-6 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Report Issue</h2>
              <p className="text-xs text-muted-foreground">Help us improve by reporting errors.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Report Submitted</h3>
            <p className="text-sm text-muted-foreground">Thank you for your feedback! Our team will review this question.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">What is the issue?</label>
              <div className="flex flex-wrap gap-2">
                {REPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedIssue(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedIssue === opt 
                        ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                        : 'bg-card border-card-border text-foreground hover:border-amber-500/50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Additional Details (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the issue briefly..."
                className="w-full h-24 p-3 rounded-xl bg-card border border-card-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 resize-none transition-colors"
              />
            </div>

            <button
              disabled={!selectedIssue || isSubmitting}
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              <span>Submit Report</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
