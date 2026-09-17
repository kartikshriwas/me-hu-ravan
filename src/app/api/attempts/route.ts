import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Attempt } from '@/models/Attempt';
import { User } from '@/models/User';
import { QuestionStat } from '@/models/QuestionStat';
import { cleanQuizId } from '@/lib/storage';
import { auth } from '@/auth';
import { getAssessmentById } from '@/lib/questionsData';

export async function POST(request: Request) {
  try {
    const sessionAuth = await auth();
    const session = sessionAuth?.user as any;
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: Token Expired or Authentication Required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      quizId,
      quizTitle,
      score,
      maxScore,
      accuracy,
      timeSpentSeconds,
      answeredCount,
      totalQuestions,
      userAnswers
    } = body;

    const userEmail = session.email;
    const userName = session.name || body.userName || 'Candidate';
    const userImage = session.image || body.userImage || '';

    const conn = await connectToDatabase();

    if (conn) {
      const clean = cleanQuizId(quizId);
      const quizIdQuery = { $in: [quizId, clean, encodeURIComponent(clean)] };

      // Deduplication guard: ignore submission if saved in the last 3 seconds
      const threeSecondsAgo = new Date(Date.now() - 3000);
      const dupQuery: any = {
        quizId: quizIdQuery,
        createdAt: { $gte: threeSecondsAgo }
      };
      if (userEmail) dupQuery.userEmail = userEmail;
      const recentDup = await Attempt.findOne(dupQuery).lean();
      if (recentDup) {
        return NextResponse.json({ success: true, data: recentDup, duplicateIgnored: true });
      }

      // Check if user has already completed a 1st attempt for this quiz
      const priorQuery: any = { quizId: quizIdQuery };
      if (userEmail) priorQuery.userEmail = userEmail;
      const priorAttempt = await Attempt.findOne(priorQuery).lean();
      const isFirstAttempt = body.isFirstAttempt !== undefined ? body.isFirstAttempt : !priorAttempt;

      // Server-side answer evaluation against master assessment dataset
      const masterAssessment = getAssessmentById(quizId) || getAssessmentById(clean);
      let calculatedScore = 0;
      let calculatedCorrectCount = 0;
      let calculatedIncorrectCount = 0;
      let calculatedUnansweredCount = 0;
      let calculatedMaxScore = maxScore || 0;

      if (masterAssessment && masterAssessment.questions) {
        calculatedMaxScore = masterAssessment.totalScore || masterAssessment.questions.reduce((sum, q) => sum + (q.score || 1), 0);

        masterAssessment.questions.forEach((q) => {
          const userAns = userAnswers ? userAnswers[q.id] : null;
          if (userAns && userAns.selectedOptionId) {
            const isCorrect =
              userAns.selectedOptionId === q.correctOptionId ||
              (q.correctOptionText &&
                userAns.selectedOptionId === q.options.find((o) => o.text.trim() === q.correctOptionText?.trim())?.id);

            if (isCorrect) {
              calculatedCorrectCount++;
              calculatedScore += (q.score || 1);
            } else {
              calculatedIncorrectCount++;
            }
          } else {
            calculatedUnansweredCount++;
          }
        });
      } else {
        calculatedScore = score || 0;
        calculatedCorrectCount = body.correctCount || 0;
        calculatedIncorrectCount = body.incorrectCount || 0;
        calculatedUnansweredCount = body.unansweredCount || 0;
      }

      const calculatedAnswered = calculatedCorrectCount + calculatedIncorrectCount;
      const calculatedAccuracy = calculatedAnswered > 0 ? Math.round((calculatedCorrectCount / calculatedAnswered) * 100) : 0;

      // Sanitize userAnswers: ONLY store questions with selected options or review flags (omit unanswered questions)
      const sanitizedUserAnswers: Record<string, any> = {};
      if (userAnswers && typeof userAnswers === 'object') {
        for (const qId of Object.keys(userAnswers)) {
          const ans = userAnswers[qId];
          if (ans && (ans.selectedOptionId || ans.isMarkedForReview)) {
            sanitizedUserAnswers[qId] = {
              selectedOptionId: ans.selectedOptionId || null,
              ...(ans.isMarkedForReview ? { isMarkedForReview: true } : {}),
              ...(ans.timeSpentSeconds > 0 ? { timeSpentSeconds: ans.timeSpentSeconds } : {})
            };
          }
        }
      }

      // 1. Save attempt record with server-evaluated score & accuracy
      const attempt = await Attempt.create({
        userEmail,
        userName,
        userImage,
        quizId: clean,
        quizTitle: masterAssessment?.title || quizTitle,
        timestamp: body.timestamp || Date.now(),
        isFirstAttempt,
        score: calculatedScore,
        maxScore: calculatedMaxScore,
        accuracy: calculatedAccuracy,
        timeSpentSeconds,
        answeredCount: calculatedAnswered,
        totalQuestions: totalQuestions || masterAssessment?.questions.length || 0,
        userAnswers: sanitizedUserAnswers
      });

      // 2. Update user profile stats ONLY if email exists AND using 1st official attempts
      if (userEmail) {
        const officialAttempts = await Attempt.find({ userEmail, isFirstAttempt: true }).select('score accuracy').lean();
        const totalScoreSum = officialAttempts.reduce((acc, a) => acc + (a.score || 0), 0);
        const avgAccuracy = Math.round(
          officialAttempts.reduce((acc, a) => acc + (a.accuracy || 0), 0) / (officialAttempts.length || 1)
        );

        await User.findOneAndUpdate(
          { email: userEmail },
          {
            totalScore: totalScoreSum,
            testsCompleted: officialAttempts.length,
            averageAccuracy: avgAccuracy,
            lastActiveAt: new Date()
          },
          { upsert: true }
        );
      }

      // 3. Update Question difficulty & accuracy statistics atomically using $inc
      if (masterAssessment && masterAssessment.questions && sanitizedUserAnswers && typeof sanitizedUserAnswers === 'object') {
        for (const qId of Object.keys(sanitizedUserAnswers)) {
          const ans = sanitizedUserAnswers[qId];
          const masterQ = masterAssessment.questions.find((q) => q.id === qId);

          if (ans?.selectedOptionId && masterQ) {
            const isCorrect =
              ans.selectedOptionId === masterQ.correctOptionId ||
              (masterQ.correctOptionText &&
                ans.selectedOptionId === masterQ.options.find((o) => o.text.trim() === masterQ.correctOptionText?.trim())?.id);

            const incFields: any = {
              totalAttempts: 1
            };

            if (isFirstAttempt) {
              incFields.firstAttemptTotal = 1;
              incFields.correctCount = isCorrect ? 1 : 0;
              incFields.wrongCount = isCorrect ? 0 : 1;
            }

            const updatedStat = await QuestionStat.findOneAndUpdate(
              { questionId: qId },
              {
                $inc: incFields,
                $set: { quizId: clean }
              },
              { upsert: true, returnDocument: 'after' }
            );

            if (updatedStat) {
              const denom = (updatedStat.firstAttemptTotal || 0) > 0
                ? updatedStat.firstAttemptTotal
                : updatedStat.totalAttempts;
              const rate = denom > 0 ? Math.round((updatedStat.correctCount / denom) * 100) : 0;
              await QuestionStat.updateOne(
                { _id: updatedStat._id },
                { $set: { accuracyRate: rate } }
              );
            }
          }
        }
      }

      return NextResponse.json({ success: true, data: attempt });
    }

    return NextResponse.json({ success: true, message: 'Saved locally' });
  } catch (error) {
    console.error('Error saving attempt to MongoDB:', error);
    return NextResponse.json({ success: false, error: 'Failed to record attempt' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const sessionAuth = await auth();
    const session = sessionAuth?.user as any;
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: Token Expired or Authentication Required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('quizId');
    const timestamp = searchParams.get('t');

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Database connection unavailable' }, { status: 500 });
    }

    const query: any = {
      userEmail: session.email
    };

    if (quizId) {
      const clean = cleanQuizId(quizId);
      query.quizId = { $in: [quizId, clean, encodeURIComponent(clean)] };
    }

    if (timestamp) {
      const tNum = parseInt(timestamp, 10);
      if (!isNaN(tNum)) {
        query.timestamp = tNum;
      }
    }

    // Omit heavy userAnswers payload when querying general history list (when quizId & timestamp are not specified)
    const selectFields = (!quizId && !timestamp) ? '-userAnswers -__v' : '-__v';

    let attempts = await Attempt.find(query).select(selectFields).sort({ createdAt: -1 }).lean();

    // Fallback: If no exact timestamp match, search by quizId alone to return latest attempt
    if (attempts.length === 0 && quizId && timestamp) {
      const clean = cleanQuizId(quizId);
      const fallbackQuery: any = { 
        userEmail: session.email,
        quizId: { $in: [quizId, clean, encodeURIComponent(clean)] } 
      };
      attempts = await Attempt.find(fallbackQuery).sort({ createdAt: -1 }).lean();
    }

    return NextResponse.json({
      success: true,
      data: attempts,
      attempt: attempts.length > 0 ? attempts[0] : null
    });
  } catch (error) {
    console.error('Error fetching attempts from MongoDB:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch attempts' }, { status: 500 });
  }
}

