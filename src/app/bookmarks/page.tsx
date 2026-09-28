'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBookmarks, BookmarkedQuestion, toggleBookmark } from '@/lib/storage';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { SignInRequired } from '@/components/SignInRequired';
import { Bookmark, Lock } from 'lucide-react';
import { BookmarksSkeleton } from '@/components/skeletons/BookmarksSkeleton';

export default function BookmarksPage() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      setBookmarks(getBookmarks(user.email));
    } else {
      setBookmarks([]);
    }
    setLoading(false);
  }, [user?.email]);

  const handleRemoveBookmark = (bm: BookmarkedQuestion) => {
    toggleBookmark(bm.quizId, bm.quizTitle, bm.question, user?.email);
    setBookmarks(getBookmarks(user?.email));
  };

  if (loading) {
    return <BookmarksSkeleton />;
  }

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main">
      
      {/* Header */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs mb-2">
            <Bookmark className="w-4 h-4" />
            <span>SAVED REVISION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Bookmarked Questions</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Questions saved during practice tests for quick review.
          </p>
        </div>

        <div className="text-xs font-semibold text-muted-foreground bg-card px-4 py-2.5 rounded-xl border border-card-border">
          {`${bookmarks.length} Saved`}
        </div>
      </header>

      {!user ? (
        <SignInRequired
          title="Sign In to View Bookmarks"
          subtitle="Please sign in with your Google account to access your saved revision questions and bookmarked problems."
        />
      ) : bookmarks.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl space-y-4">
          <Bookmark className="w-10 h-10 text-primary-600 dark:text-primary-400 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">No Bookmarks Saved</h2>
          <p className="text-xs text-muted-foreground">
            Click the bookmark icon (or press S) during any assessment test to save questions for later revision.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-colors"
          >
            Start Practice
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {bookmarks.map((bm) => (
            <article key={bm.question.id} className="relative group">
              <QuestionRenderer
                question={bm.question}
                currentNumber={bm.question.questionNumber}
                totalQuestions={bookmarks.length}
                selectedOptionId={bm.question.correctOptionId}
                onSelectOption={() => {}}
                isMarkedForReview={false}
                isBookmarked={true}
                showSolutionImmediately={true}
              />
            </article>
          ))}
        </div>
      )}

    </main>
  );
}
