import { NextResponse } from 'next/server';
import { getAssessmentById } from '@/lib/questionsData';
import { connectToDatabase } from '@/lib/db';
import { QuestionStat } from '@/models/QuestionStat';
import { Attempt } from '@/models/Attempt';
import { User } from '@/models/User';
import { isPlatformGlobalFree } from '@/lib/globalSetting';
import { cleanQuizId } from '@/lib/storage';
import { getSessionFromRequest } from '@/lib/session';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: Authentication Required or Token Expired' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const cleanId = cleanQuizId(id);
    const assessment = getAssessmentById(cleanId) || getAssessmentById(id);

    if (!assessment) {
      return NextResponse.json({ success: false, error: 'Practice test not found' }, { status: 404 });
    }

    const setMatch = (assessment.quizId || cleanId).match(/\d+/);
    const setNum = setMatch ? parseInt(setMatch[0], 10) : 1;

    await connectToDatabase();
    const cleanEmail = session.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const dbUser = await User.findOne({ email: cleanEmail }).lean();
    const { isGlobalFree } = await isPlatformGlobalFree();

    let isPremium = !!(dbUser?.isPremium || isSuperadmin || isGlobalFree);
    if (isPremium && !isSuperadmin && !isGlobalFree && dbUser?.premiumExpiresAt && new Date(dbUser.premiumExpiresAt) < new Date()) {
      isPremium = false;
    }

    // Set 1 is free for everyone. Set 2 and higher require premium access.
    const isLocked = setNum > 1 && !isPremium;

    if (isLocked) {
      return NextResponse.json(
        {
          success: false,
          isLocked: true,
          error: 'Premium Pass Required: SET 2 and higher require an active PrepTea Candidate Pass.',
        },
        { status: 403 }
      );
    }

    let candidateCount = 0;
    let avgAccuracy = 0;
    const qStatsMap: Record<string, { totalAttempts: number; accuracyRate: number }> = {};

    const stats = await Attempt.aggregate([
      { $match: { quizId: { $in: [id, cleanId, encodeURIComponent(cleanId)] }, isFirstAttempt: { $ne: false } } },
      { $group: { _id: null, count: { $sum: 1 }, avgAccuracy: { $avg: '$accuracy' } } }
    ]);
    if (stats.length > 0) {
      candidateCount = stats[0].count;
      avgAccuracy = Math.round(stats[0].avgAccuracy || 0);
    }

    const qStats = await QuestionStat.find({ quizId: { $in: [id, cleanId, encodeURIComponent(cleanId)] } })
      .select('questionId totalAttempts firstAttemptTotal correctCount accuracyRate')
      .lean();
    qStats.forEach((qs) => {
      const denom = (qs.firstAttemptTotal || 0) > 0 ? qs.firstAttemptTotal : (qs.totalAttempts || 0);
      const rate = denom > 0
        ? Math.round(((qs.correctCount || 0) / denom) * 100)
        : (qs.accuracyRate || 0);
      qStatsMap[qs.questionId] = {
        totalAttempts: qs.totalAttempts || 0,
        accuracyRate: rate,
      };
    });

    const { searchParams } = new URL(request.url);
    const includeAnswers = searchParams.get('includeAnswers') === 'true';

    const enrichedQuestions = assessment.questions.map((q) => {
      const qData: any = {
        id: q.id,
        type: q.type,
        questionNumber: q.questionNumber,
        htmlText: q.htmlText,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        score: q.score,
        totalAttempts: qStatsMap[q.id]?.totalAttempts || 0,
        accuracyRate: qStatsMap[q.id]?.accuracyRate || 0,
      };

      if (includeAnswers) {
        qData.correctOptionId = q.correctOptionId;
        qData.correctOptionText = q.correctOptionText;
        qData.explanationHtml = q.explanationHtml;
      }

      return qData;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: assessment.quizId,
        quizId: assessment.quizId,
        title: assessment.title,
        description: assessment.description,
        timeLimitSeconds: assessment.timeLimitSeconds,
        questionTimeLimitSeconds: assessment.questionTimeLimitSeconds,
        totalQuestions: assessment.totalQuestions,
        totalScore: assessment.totalScore,
        difficulty: assessment.difficulty,
        candidateCount,
        avgAccuracy,
        questions: enrichedQuestions,
      },
    });
  } catch (error) {
    console.error('Error in assessment detail API:', error);
    return NextResponse.json({ success: false, error: 'Failed to load practice test' }, { status: 500 });
  }
}
