import fs from 'fs';
import path from 'path';
import { getQuestionsDirectory } from './pathHelper';
import { AssessmentDetail, AssessmentMeta, QuestionBlock, QuestionOption } from './types';

const parsedAssessmentCache = new Map<string, { data: AssessmentDetail; mtime: number }>();
let cachedAllAssessments: AssessmentMeta[] | null = null;
let lastAllAssessmentsTime = 0;
const ALL_ASSESSMENTS_TTL_MS = 15000; // 15-second memory cache for question metadata catalog

function extractHtmlFromWidgets(widgets: any[]): string {
  if (!Array.isArray(widgets)) return '';
  return widgets
    .map((w: any) => {
      if (typeof w === 'string') return w;
      if (w?.properties?.html) return w.properties.html;
      if (w?.description?.text) return w.description.text;
      if (w?.text) return w.text;
      if (w?.type === 'image' || w?.properties?.imageData) {
        const link = w.properties?.imageData?.link || w.properties?.imageData?.link_small || w.properties?.url;
        if (link) {
          return `<img src="${link}" alt="Option Image" class="max-h-40 object-contain rounded-lg border border-slate-800/80 p-1 bg-slate-950/40 my-1" />`;
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('<br />');
}

function buildFeedbackMap(data: any): Map<string, any> {
  const map = new Map<string, any>();

  const processBlock = (b: any) => {
    if (!b || !b.id) return;
    const existing = map.get(b.id) || {};
    map.set(b.id, {
      ...existing,
      ...b,
      correctAnswers: b.correctAnswers || existing.correctAnswers,
      questionFeedback: b.questionFeedback || existing.questionFeedback
    });
  };

  // 1. Direct root feedback
  const rootFeedback = data.feedback || data.assessment?.feedback || [];
  if (Array.isArray(rootFeedback)) {
    for (const sec of rootFeedback) {
      const blocks = sec.blocks || [];
      for (const b of blocks) processBlock(b);
    }
  }

  // 2. Latest submission feedback
  const latestSubFeedback = data.latestSubmission?.feedback || [];
  if (Array.isArray(latestSubFeedback)) {
    for (const sec of latestSubFeedback) {
      const blocks = sec.blocks || [];
      for (const b of blocks) processBlock(b);
    }
  }

  // 3. Assessment submissions
  const submissions = data.assessmentSubmissions || data.assessment?.assessmentSubmissions || [];
  if (Array.isArray(submissions)) {
    for (const sub of submissions) {
      const feedback = sub.feedback || [];
      for (const sec of feedback) {
        const blocks = sec.blocks || [];
        for (const b of blocks) processBlock(b);
      }
    }
  }

  return map;
}

function parseQuestionBlock(block: any, index: number, feedbackBlock?: any): QuestionBlock | null {
  if (!block || !block.id) return null;

  const bData = block.blockData || block;

  // 1. Extract Question Text
  const descriptionObj = bData.description || block.description;
  let promptHtml = '';

  if (descriptionObj) {
    if (Array.isArray(descriptionObj.widgets) && descriptionObj.widgets.length > 0) {
      promptHtml = extractHtmlFromWidgets(descriptionObj.widgets);
    } else if (typeof descriptionObj.text === 'string' && descriptionObj.text.trim()) {
      promptHtml = descriptionObj.text;
    }
  }

  if (!promptHtml) {
    const widgets = bData.widgets || block.widgets;
    if (Array.isArray(widgets) && widgets.length > 0) {
      promptHtml = extractHtmlFromWidgets(widgets);
    }
  }

  if (!promptHtml) {
    promptHtml = bData.promptHtml || bData.promptText || block.promptHtml || block.promptText || 'Question Prompt';
  }

  // 2. Extract Options
  const rawOptions = bData.options || bData.choices || block.options || block.choices || [];
  const options: QuestionOption[] = [];

  rawOptions.forEach((opt: any, oIdx: number) => {
    const optId = opt.id || `opt_${oIdx + 1}`;
    let optText = '';

    const optDesc = opt.description;
    if (optDesc) {
      if (Array.isArray(optDesc.widgets) && optDesc.widgets.length > 0) {
        optText = extractHtmlFromWidgets(optDesc.widgets);
      } else if (typeof optDesc.text === 'string' && optDesc.text.trim()) {
        optText = optDesc.text;
      }
    }

    if (!optText && Array.isArray(opt.widgets) && opt.widgets.length > 0) {
      optText = extractHtmlFromWidgets(opt.widgets);
    }

    if (!optText) {
      optText = opt.text || opt.label || opt.value || `Option ${oIdx + 1}`;
    }

    options.push({
      id: optId,
      text: optText,
    });
  });

  // 3. Extract Correct Answer ID & Text
  let correctOptionId: string | null = null;
  let correctOptionText: string | null = null;

  const correctAnswers = feedbackBlock?.correctAnswers || bData.correctAnswers || block.correctAnswers || block.answers || [];
  if (Array.isArray(correctAnswers) && correctAnswers.length > 0) {
    const firstAns = correctAnswers[0];
    if (typeof firstAns === 'string') {
      correctOptionId = firstAns;
    } else if (typeof firstAns === 'object' && firstAns) {
      correctOptionId = firstAns.id || null;
      if (firstAns.text) correctOptionText = firstAns.text;
    }
  }

  if (!correctOptionId && options.length > 0) {
    const correctOpt = rawOptions.find((o: any) => o.isCorrect || o.correct === true);
    if (correctOpt) {
      correctOptionId = correctOpt.id || options[0].id;
    }
  }

  if (correctOptionId && !correctOptionText) {
    const matchedOpt = options.find((o) => o.id === correctOptionId);
    if (matchedOpt) {
      correctOptionText = matchedOpt.text;
    }
  }

  // 4. Extract Explanation HTML
  const questionFeedback = feedbackBlock?.questionFeedback || bData.questionFeedback || block.questionFeedback;
  let explanationHtml: string | null = null;

  if (Array.isArray(questionFeedback)) {
    explanationHtml = questionFeedback
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && Array.isArray(item.widgets)) return extractHtmlFromWidgets(item.widgets);
        return '';
      })
      .filter(Boolean)
      .join('<br />');
  } else if (questionFeedback && Array.isArray(questionFeedback.widgets)) {
    explanationHtml = extractHtmlFromWidgets(questionFeedback.widgets);
  }

  return {
    id: block.id,
    type: block.type || bData.type || 'multiple_choice',
    questionNumber: index + 1,
    htmlText: promptHtml,
    options,
    correctOptionId: correctOptionId || (options[0]?.id || null),
    correctOptionText: correctOptionText || (options[0]?.text || null),
    explanationHtml: explanationHtml || null,
    score: 1,
  };
}

export function getAllAssessments(): AssessmentMeta[] {
  const now = Date.now();
  if (cachedAllAssessments && now - lastAllAssessmentsTime < ALL_ASSESSMENTS_TTL_MS) {
    return cachedAllAssessments;
  }

  const dir = getQuestionsDirectory();
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'));
  const results: AssessmentMeta[] = [];

  for (const file of files) {
    try {
      const parsed = parseAssessmentFile(path.join(dir, file), path.basename(file, '.json'));
      if (parsed) {
        results.push({
          id: parsed.quizId,
          title: parsed.title,
          quizId: parsed.quizId,
          description: parsed.description,
          timeLimitSeconds: parsed.timeLimitSeconds,
          questionTimeLimitSeconds: parsed.questionTimeLimitSeconds,
          totalQuestions: parsed.totalQuestions,
          totalScore: parsed.totalScore,
          difficulty: parsed.difficulty
        });
      }
    } catch (err) {
      console.error(`Failed to parse assessment file ${file}:`, err);
    }
  }

  // Sort by quizId (q1, q2, q3...)
  const sorted = results.sort((a, b) => {
    const numA = parseInt(a.quizId.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.quizId.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  cachedAllAssessments = sorted;
  lastAllAssessmentsTime = now;
  return sorted;
}

function cleanQuizId(rawId: string): string {
  if (!rawId) return '';
  let current = rawId;
  try {
    while (current.includes('%')) {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    }
  } catch {
    // Return last valid decoded value
  }
  return current;
}

export function getAssessmentById(rawQuizId: string): AssessmentDetail | null {
  const dir = getQuestionsDirectory();
  if (!fs.existsSync(dir)) return null;

  const quizId = cleanQuizId(rawQuizId);
  const targetFileName = quizId.toLowerCase().endsWith('.json') ? quizId : `${quizId}.json`;
  const fullPath = path.join(dir, targetFileName);

  if (!fs.existsSync(fullPath)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      if (path.basename(file, '.json').toLowerCase() === quizId.toLowerCase()) {
        return parseAssessmentFile(path.join(dir, file), quizId);
      }
    }
    return null;
  }

  return parseAssessmentFile(fullPath, quizId);
}

function parseAssessmentFile(filePath: string, quizId: string): AssessmentDetail | null {
  try {
    const stat = fs.statSync(filePath);
    const cached = parsedAssessmentCache.get(filePath);

    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.data;
    }

    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawContent);
    const assessment = data.assessment || data;
    const feedbackMap = buildFeedbackMap(data);

    const title = assessment.title || `Practice Paper (${quizId.toUpperCase()})`;
    let difficulty: 'Easy' | 'Medium' | 'Hard' | 'Practice' = 'Practice';
    const titleLower = title.toLowerCase();
    if (titleLower.includes('easy')) difficulty = 'Easy';
    else if (titleLower.includes('medium')) difficulty = 'Medium';
    else if (titleLower.includes('hard')) difficulty = 'Hard';

    let scorePerQuestion = 1;
    if (difficulty === 'Medium') scorePerQuestion = 2;
    if (difficulty === 'Hard') scorePerQuestion = 3;

    const questions: QuestionBlock[] = [];
    let qIndex = 0;

    const sections = assessment.sections || [];
    for (const section of sections) {
      const blocks = section.blocks || [];
      for (const block of blocks) {
        const feedbackBlock = feedbackMap.get(block.id);
        const parsed = parseQuestionBlock(block, qIndex, feedbackBlock);
        if (parsed) {
          parsed.score = scorePerQuestion;
          questions.push(parsed);
          qIndex++;
        }
      }
    }

    const totalScore = questions.reduce((acc, q) => acc + q.score, 0);

    const resultData: AssessmentDetail = {
      id: quizId,
      quizId,
      title,
      description: assessment.description || 'Test paper assessment for practice and learning.',
      timeLimitSeconds: assessment.timeLimitSeconds || (questions.length * 60),
      questionTimeLimitSeconds: assessment.questionTimeLimitSeconds || 60,
      totalQuestions: questions.length,
      totalScore,
      difficulty,
      questions
    };

    parsedAssessmentCache.set(filePath, { data: resultData, mtime: stat.mtimeMs });
    return resultData;
  } catch (error) {
    console.error(`Failed to parse assessment file ${filePath}:`, error);
    return null;
  }
}
