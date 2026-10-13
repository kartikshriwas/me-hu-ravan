import { QuizAttemptResult, QuestionBlock } from './types';

const HISTORY_KEY = 'preptea_quiz_history';
const BOOKMARKS_KEY = 'preptea_bookmarked_questions';

export interface BookmarkedQuestion {
  quizId: string;
  quizTitle: string;
  question: QuestionBlock;
  savedAt: number;
}

export function cleanQuizId(rawId: string | undefined | null): string {
  if (!rawId) return '';
  let current = rawId;
  try {
    while (current.includes('%')) {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    }
  } catch {
    // Return last decoded value
  }
  return current;
}

export function isQuizMatch(id1: string | undefined | null, id2: string | undefined | null): boolean {
  if (!id1 || !id2) return false;
  if (id1 === id2) return true;
  return cleanQuizId(id1).toLowerCase() === cleanQuizId(id2).toLowerCase();
}


function getHistoryKey(userEmail?: string | null): string {
  if (!userEmail) return `${HISTORY_KEY}_guest`;
  const cleanEmail = userEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${HISTORY_KEY}_${cleanEmail}`;
}

function getBookmarksKey(userEmail?: string | null): string {
  if (!userEmail) return `${BOOKMARKS_KEY}_guest`;
  const cleanEmail = userEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${BOOKMARKS_KEY}_${cleanEmail}`;
}

export function clearUserLocalData(userEmail?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userEmail) {
      localStorage.removeItem(getHistoryKey(userEmail));
      localStorage.removeItem(getBookmarksKey(userEmail));
    }
    localStorage.removeItem(getHistoryKey(null));
    localStorage.removeItem(getBookmarksKey(null));
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(BOOKMARKS_KEY);
  } catch (err) {
    console.error('Failed to clear user local data:', err);
  }
}

export function saveQuizAttempt(attempt: QuizAttemptResult, userEmail?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getHistoryKey(userEmail);
    const existing = getQuizHistory(userEmail);
    if (typeof attempt.isFirstAttempt === 'undefined') {
      const hasPriorAttempt = existing.some((a) => isQuizMatch(a.quizId, attempt.quizId) && a.timestamp !== attempt.timestamp);
      attempt.isFirstAttempt = !hasPriorAttempt;
    }
    const updated = [attempt, ...existing.filter((a) => a.timestamp !== attempt.timestamp)];
    localStorage.setItem(key, JSON.stringify(updated.slice(0, 50)));
  } catch (err) {
    console.error('Failed to save quiz history:', err);
  }
}

export function getQuizHistory(userEmail?: string | null): QuizAttemptResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getHistoryKey(userEmail);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load quiz history:', err);
    return [];
  }
}

export function getBookmarks(userEmail?: string | null): BookmarkedQuestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getBookmarksKey(userEmail);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load bookmarks:', err);
    return [];
  }
}

export function toggleBookmark(quizId: string, quizTitle: string, question: QuestionBlock, userEmail?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = getBookmarksKey(userEmail);
    const existing = getBookmarks(userEmail);
    const isBookmarked = existing.some(b => b.question.id === question.id);

    let updated: BookmarkedQuestion[];
    if (isBookmarked) {
      updated = existing.filter(b => b.question.id !== question.id);
    } else {
      updated = [
        { quizId, quizTitle, question, savedAt: Date.now() },
        ...existing
      ];
    }

    localStorage.setItem(key, JSON.stringify(updated));
    return !isBookmarked;
  } catch (err) {
    console.error('Failed to toggle bookmark:', err);
    return false;
  }
}

export function isQuestionBookmarked(questionId: string, userEmail?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  const bookmarks = getBookmarks(userEmail);
  return bookmarks.some(b => b.question.id === questionId);
}
